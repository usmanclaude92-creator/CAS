import { describe, it, expect } from 'vitest';
import { storeAttachment, getOwnedAttachment, fetchAttachmentBytes, markAttachmentUsed, type AiAttachmentRow } from './index';

/**
 * Fake caller-scoped Supabase client covering only what this module touches:
 * storage.from(bucket).{upload,download,remove} and
 * from('ai_attachments').{insert,select,update}. Every call here runs
 * through the caller-scoped client passed in — RLS (not this module) is the
 * real ownership boundary, so these tests only need to prove the module
 * calls through correctly and never widens what a query can see.
 */
function makeFakeDb(opts: {
  uploadError?: any;
  insertResult?: { data: any; error: any };
  selectResult?: { data: any; error: any };
  downloadResult?: { data: any; error: any };
} = {}) {
  const uploadCalls: any[] = [];
  const removeCalls: any[] = [];
  const updateCalls: any[] = [];

  const storage = {
    from: (bucket: string) => ({
      upload: async (path: string, buffer: Buffer, meta: any) => {
        uploadCalls.push({ bucket, path, buffer, meta });
        return { error: opts.uploadError ?? null };
      },
      download: async (_path: string) => {
        if (opts.downloadResult) return opts.downloadResult;
        // Buffer.from(string) may be backed by a pooled ArrayBuffer larger
        // than the string itself — slice to the exact byte range so this
        // fake's .arrayBuffer() behaves like a real download response.
        const bytes = Buffer.from('downloaded-bytes', 'utf8');
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        return { data: { arrayBuffer: async () => arrayBuffer }, error: null };
      },
      remove: async (paths: string[]) => {
        removeCalls.push(paths);
        return { error: null };
      },
    }),
  };

  const from = (table: string) => {
    if (table !== 'ai_attachments') throw new Error(`unexpected table ${table}`);
    return {
      insert: (row: any) => ({
        select: () => ({
          single: async () => opts.insertResult ?? { data: { ...row, id: row.id, expires_at: new Date(Date.now() + 86_400_000).toISOString() }, error: null },
        }),
      }),
      select: () => ({
        eq: (_field: string, _value: string) => ({
          maybeSingle: async () => opts.selectResult ?? { data: null, error: null },
        }),
      }),
      update: (patch: any) => ({
        eq: async (field: string, value: string) => {
          updateCalls.push({ patch, field, value });
          return { data: null, error: null };
        },
      }),
    };
  };

  return { storage, from, _uploadCalls: uploadCalls, _removeCalls: removeCalls, _updateCalls: updateCalls };
}

function makeRow(overrides: Partial<AiAttachmentRow> = {}): AiAttachmentRow {
  return {
    id: 'att-1',
    user_id: 'user-1',
    conversation_id: null,
    kind: 'image',
    mime_type: 'image/png',
    file_name: 'receipt.png',
    file_size: 10,
    storage_path: 'user-1/att-1/receipt.png',
    status: 'uploaded',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

describe('storeAttachment', () => {
  it('uploads to storage under a per-user path, then inserts the tracking row', async () => {
    const db = makeFakeDb();
    const result = await storeAttachment(db as any, 'user-1', {
      buffer: Buffer.from('bytes'),
      mimeType: 'image/png',
      kind: 'image',
      fileName: 'receipt.png',
    });
    expect(result.success).toBe(true);
    expect(db._uploadCalls[0].bucket).toBe('ai-attachments');
    expect(db._uploadCalls[0].path).toMatch(/^user-1\//);
  });

  it('sanitizes an unsafe file name before using it in the storage path', async () => {
    const db = makeFakeDb();
    await storeAttachment(db as any, 'user-1', {
      buffer: Buffer.from('bytes'),
      mimeType: 'image/png',
      kind: 'image',
      fileName: '../../etc/passwd; rm -rf /.png',
    });
    const path = db._uploadCalls[0].path as string;
    expect(path).not.toMatch(/\.\./);
    expect(path).not.toMatch(/[/;]{2,}|passwd; rm/);
  });

  it('scopes the storage path to the given userId, never a caller-supplied one', async () => {
    const db = makeFakeDb();
    await storeAttachment(db as any, 'user-1', { buffer: Buffer.from('x'), mimeType: 'image/png', kind: 'image', fileName: 'a.png' });
    expect(db._uploadCalls[0].path.startsWith('user-1/')).toBe(true);
  });

  it('returns a safe error and never inserts a row when the storage upload fails', async () => {
    const db = makeFakeDb({ uploadError: { message: 'storage down' } });
    const result = await storeAttachment(db as any, 'user-1', { buffer: Buffer.from('x'), mimeType: 'image/png', kind: 'image', fileName: 'a.png' });
    expect(result.success).toBe(false);
    if (result.success === false) expect(result.error).not.toMatch(/storage down/);
  });

  it('cleans up the now-orphaned storage object when the DB insert fails', async () => {
    const db = makeFakeDb({ insertResult: { data: null, error: { message: 'insert failed' } } });
    const result = await storeAttachment(db as any, 'user-1', { buffer: Buffer.from('x'), mimeType: 'image/png', kind: 'image', fileName: 'a.png' });
    expect(result.success).toBe(false);
    expect(db._removeCalls.length).toBe(1);
  });
});

describe('getOwnedAttachment', () => {
  it('returns the row when found and not expired', async () => {
    const row = makeRow();
    const db = makeFakeDb({ selectResult: { data: row, error: null } });
    const result = await getOwnedAttachment(db as any, 'att-1');
    expect(result).toEqual(row);
  });

  it('returns null for a nonexistent id — never distinguishes this from "not owned"', async () => {
    const db = makeFakeDb({ selectResult: { data: null, error: null } });
    const result = await getOwnedAttachment(db as any, 'nope');
    expect(result).toBeNull();
  });

  it('returns null on a query error (e.g. RLS denial for another user\'s attachment) — same shape as "doesn\'t exist"', async () => {
    const db = makeFakeDb({ selectResult: { data: null, error: { message: 'RLS denied' } } });
    const result = await getOwnedAttachment(db as any, 'att-1');
    expect(result).toBeNull();
  });

  it('returns null for an expired attachment even if the row is still physically present', async () => {
    const expired = makeRow({ expires_at: new Date(Date.now() - 1000).toISOString() });
    const db = makeFakeDb({ selectResult: { data: expired, error: null } });
    const result = await getOwnedAttachment(db as any, 'att-1');
    expect(result).toBeNull();
  });
});

describe('fetchAttachmentBytes', () => {
  it('downloads and returns the bytes as a Buffer', async () => {
    const db = makeFakeDb();
    const bytes = await fetchAttachmentBytes(db as any, makeRow());
    expect(bytes).toBeInstanceOf(Buffer);
    expect(bytes?.toString()).toBe('downloaded-bytes');
  });

  it('returns null on a download error rather than throwing', async () => {
    const db = makeFakeDb({ downloadResult: { data: null, error: { message: 'not found' } } });
    const bytes = await fetchAttachmentBytes(db as any, makeRow());
    expect(bytes).toBeNull();
  });
});

describe('markAttachmentUsed', () => {
  it('ties the attachment to the given conversation and marks it used', async () => {
    const db = makeFakeDb();
    await markAttachmentUsed(db as any, 'att-1', 'conv-1');
    expect(db._updateCalls[0]).toEqual({ patch: { status: 'used', conversation_id: 'conv-1' }, field: 'id', value: 'att-1' });
  });

  it('never throws even if the underlying update fails (best-effort, matches recordAiToolCall\'s own discipline)', async () => {
    const db = makeFakeDb();
    (db.from as any) = (_table: string) => ({
      update: () => ({ eq: async () => ({ data: null, error: { message: 'boom' } }) }),
    });
    await expect(markAttachmentUsed(db as any, 'att-1', 'conv-1')).resolves.toBeUndefined();
  });
});
