import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

const mocks = vi.hoisted(() => ({
  getCallerContext: vi.fn(),
  callerHasPermission: vi.fn(),
  log: vi.fn(),
  createCallerScopedClient: vi.fn(),
  indexKnowledgeSource: vi.fn(),
}));

vi.mock('../authContext', () => ({
  getCallerContext: mocks.getCallerContext,
  callerHasPermission: mocks.callerHasPermission,
  log: mocks.log,
}));

vi.mock('./db', () => ({ createCallerScopedClient: mocks.createCallerScopedClient }));

vi.mock('./rag/ingestion', async () => {
  const actual = await vi.importActual<typeof import('./rag/ingestion')>('./rag/ingestion');
  return { ...actual, indexKnowledgeSource: mocks.indexKnowledgeSource };
});

import { knowledgeAdminRouter } from './knowledgeAdminRouter';

function makeFakeDb(seed: any[] = []) {
  let rows = seed.map((r) => ({ ...r }));
  let counter = rows.length;
  return {
    _rows: () => rows,
    from: () => ({
      select(columns?: string) {
        const project = (row: any) => {
          if (!columns || columns.trim() === '*') return row;
          const fields = columns.split(',').map((c) => c.trim());
          return Object.fromEntries(fields.map((f) => [f, row[f]]));
        };
        let filtered = [...rows].map(project);
        const builder: any = {
          eq(field: string, value: any) {
            filtered = filtered.filter((r) => r[field] === value);
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return (async () => ({ data: filtered, error: null }))();
          },
          maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
        };
        return builder;
      },
      insert(row: any) {
        return {
          select: () => ({
            single: async () => {
              const full = { id: `id-${++counter}`, version: 1, status: 'draft', created_at: 't', updated_at: 't', ...row };
              rows.push(full);
              return { data: full, error: null };
            },
          }),
        };
      },
      update(patch: any) {
        return {
          eq: (field: string, value: any) => ({
            select: () => ({
              single: async () => {
                const row = rows.find((r) => r[field] === value);
                if (!row) return { data: null, error: { message: 'not found' } };
                Object.assign(row, patch);
                return { data: row, error: null };
              },
            }),
          }),
        };
      },
    }),
  };
}

function makeServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/knowledge', knowledgeAdminRouter);
  return http.createServer(app);
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = makeServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const CALLER = { userId: 'admin-1', email: 'admin@test.com', profile: {}, role: { code: 'x', permissions: ['knowledge.manage'] }, jwt: 'fake-jwt' };

beforeEach(() => {
  mocks.getCallerContext.mockReset();
  mocks.callerHasPermission.mockReset();
  mocks.log.mockReset();
  mocks.createCallerScopedClient.mockReset();
  mocks.indexKnowledgeSource.mockReset();
});

describe('knowledgeAdminRouter — auth gates', () => {
  it('401s with no session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge`);
      expect(res.status).toBe(401);
    });
  });

  it('403s for an authenticated caller without knowledge.manage — never reaches the DB', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(false);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(403);
      expect(mocks.createCallerScopedClient).not.toHaveBeenCalled();
    });
  });
});

describe('knowledgeAdminRouter — CRUD lifecycle', () => {
  beforeEach(() => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(true);
  });

  it('creates a draft source with validated fields', async () => {
    const db = makeFakeDb();
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Invoice Guide', content: 'How invoicing works.', sourceType: 'markdown' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Invoice Guide');
      expect(body.data.status).toBe('draft');
      expect(body.data.created_by).toBe('admin-1');
    });
  });

  it('rejects creation without a title or content', async () => {
    const db = makeFakeDb();
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', content: '' }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('rejects an invalid sourceType/visibility enum value', async () => {
    const db = makeFakeDb();
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 't', content: 'c', sourceType: 'pdf' }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('404s for a detail request on an unknown id', async () => {
    const db = makeFakeDb();
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/missing`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(404);
    });
  });

  it('editing content bumps version and resets indexing_status to pending', async () => {
    const db = makeFakeDb([{ id: 'src-1', title: 'Old', content: 'Old content', version: 1, status: 'published', indexing_status: 'indexed', source_type: 'markdown', visibility: 'internal' }]);
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/src-1`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New content' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.version).toBe(2);
      expect(body.data.indexing_status).toBe('pending');
    });
  });

  it('editing only the title (no content change) does not bump version or touch indexing_status', async () => {
    const db = makeFakeDb([{ id: 'src-1', title: 'Old', content: 'Same content', version: 1, status: 'published', indexing_status: 'indexed', source_type: 'markdown', visibility: 'internal' }]);
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/src-1`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title', content: 'Same content' }),
      });
      const body = await res.json();
      expect(body.data.version).toBe(1);
      expect(body.data.indexing_status).toBe('indexed');
      expect(body.data.title).toBe('New Title');
    });
  });

  it('publishes a draft source', async () => {
    const db = makeFakeDb([{ id: 'src-1', title: 't', content: 'c', version: 1, status: 'draft' }]);
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/src-1/publish`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('published');
    });
  });

  it('archives a published source (never a hard delete)', async () => {
    const db = makeFakeDb([{ id: 'src-1', title: 't', content: 'c', version: 1, status: 'published' }]);
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/src-1/archive`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('archived');
    });
  });

  it('404s publish/archive for an unknown id', async () => {
    const db = makeFakeDb();
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/missing/publish`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(404);
    });
  });

  it('reindex delegates to indexKnowledgeSource and returns its chunk count', async () => {
    const db = makeFakeDb([{ id: 'src-1', title: 't', content: 'c', version: 1 }]);
    mocks.createCallerScopedClient.mockReturnValue(db);
    mocks.indexKnowledgeSource.mockResolvedValue({ success: true, chunkCount: 7 });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/src-1/reindex`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, chunkCount: 7 });
      expect(mocks.indexKnowledgeSource).toHaveBeenCalledWith(db, 'src-1');
    });
  });

  it('reindex failure surfaces as a safe 422, not a crash', async () => {
    const db = makeFakeDb([{ id: 'src-1' }]);
    mocks.createCallerScopedClient.mockReturnValue(db);
    mocks.indexKnowledgeSource.mockResolvedValue({ success: false, error: 'Embedding provider is not configured.' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge/src-1/reindex`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  it('lists sources without leaking content/embeddings in the list response', async () => {
    const db = makeFakeDb([{ id: 'src-1', title: 't', content: 'should not appear in list', version: 1, status: 'draft' }]);
    mocks.createCallerScopedClient.mockReturnValue(db);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/knowledge`, { headers: { Authorization: 'Bearer x' } });
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data[0].content).toBeUndefined();
    });
  });
});
