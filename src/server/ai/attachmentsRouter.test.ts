import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

/**
 * Same harness as router.test.ts/voiceRouter.test.ts: a real http server
 * around the real attachmentsRouter, `../authContext` and `./db` mocked for
 * deterministic auth, `storeAttachment` mocked (its own storage/DB behavior
 * is covered in attachments/index.test.ts) — but validateAttachmentUpload
 * runs FOR REAL, so the size/MIME/magic-byte gate is genuinely exercised
 * here, not stubbed out.
 */
const mocks = vi.hoisted(() => ({
  getCallerContext: vi.fn(),
  log: vi.fn(),
  createCallerScopedClient: vi.fn(() => ({})),
  storeAttachment: vi.fn(),
}));

vi.mock('../authContext', () => ({
  SUPABASE_URL: 'http://127.0.0.1:9',
  supabaseAdmin: null,
  log: mocks.log,
  getCallerContext: mocks.getCallerContext,
  callerHasPermission: vi.fn(),
}));

vi.mock('./db', () => ({ createCallerScopedClient: mocks.createCallerScopedClient }));

vi.mock('./attachments', async () => {
  const actual = await vi.importActual<typeof import('./attachments')>('./attachments');
  return { ...actual, storeAttachment: mocks.storeAttachment };
});

import { attachmentsRouter } from './attachmentsRouter';

function makeServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/attachments', attachmentsRouter);
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

const CALLER = { userId: 'user-1', email: 'test@example.com', profile: { status: 'active' }, role: { code: 'x', permissions: [] }, jwt: 'fake-jwt' };

function pngBytes(width = 100, height = 100): Uint8Array {
  const buf = new Uint8Array(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  const view = new DataView(buf.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return buf;
}

beforeEach(() => {
  mocks.getCallerContext.mockReset();
  mocks.log.mockReset();
  mocks.createCallerScopedClient.mockReset().mockReturnValue({});
  mocks.storeAttachment.mockReset();
});

describe('POST /api/ai/attachments', () => {
  it('401s when there is no valid session, before any file is parsed', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const form = new FormData();
      form.append('file', new Blob([pngBytes()], { type: 'image/png' }), 'receipt.png');
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', body: form });
      expect(res.status).toBe(401);
      expect(mocks.storeAttachment).not.toHaveBeenCalled();
    });
  });

  it('400s when no file field is provided', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: new FormData() });
      expect(res.status).toBe(400);
    });
  });

  it('400s for a file type outside the image/PDF allow-list', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'application/x-sh' }), 'script.sh');
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(400);
      expect(mocks.storeAttachment).not.toHaveBeenCalled();
    });
  });

  it('400s when the uploaded bytes do not match the declared image type — never trusts the client MIME alone', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const form = new FormData();
      // Genuine PNG bytes, declared as a JPEG.
      form.append('file', new Blob([pngBytes()], { type: 'image/jpeg' }), 'fake.jpg');
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(400);
      expect(mocks.storeAttachment).not.toHaveBeenCalled();
    });
  });

  it('400s an image over the per-image byte limit even though it is well under the multipart upload limit', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const oversized = new Uint8Array(9 * 1024 * 1024); // over 8MB image cap, under the 20MB upload cap
      oversized.set(pngBytes(), 0);
      const form = new FormData();
      form.append('file', new Blob([oversized], { type: 'image/png' }), 'big.png');
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(400);
      expect(mocks.storeAttachment).not.toHaveBeenCalled();
    });
  }, 20000);

  it('413s a file over the overall multipart upload limit before any validation runs', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const huge = new Uint8Array(20 * 1024 * 1024 + 1);
      huge.set(pngBytes(), 0);
      const form = new FormData();
      form.append('file', new Blob([huge], { type: 'image/png' }), 'huge.png');
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(413);
      expect(mocks.storeAttachment).not.toHaveBeenCalled();
    });
  }, 20000);

  it('201s and returns the stored attachment metadata for a valid image', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    mocks.storeAttachment.mockResolvedValue({
      success: true,
      attachment: {
        id: 'att-1',
        user_id: 'user-1',
        conversation_id: null,
        kind: 'image',
        mime_type: 'image/png',
        file_name: 'receipt.png',
        file_size: 24,
        storage_path: 'user-1/att-1/receipt.png',
        status: 'uploaded',
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
    });
    await withServer(async (base) => {
      const form = new FormData();
      form.append('file', new Blob([pngBytes()], { type: 'image/png' }), 'receipt.png');
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({
        success: true,
        attachment: { id: 'att-1', kind: 'image', mimeType: 'image/png', fileName: 'receipt.png', fileSize: 24, expiresAt },
      });
      // storeAttachment is always called with the caller's OWN userId — the
      // client never supplies whose attachment this is.
      expect(mocks.storeAttachment.mock.calls[0][1]).toBe('user-1');
    });
  });

  it('500s safely when storeAttachment fails, without leaking internal detail', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.storeAttachment.mockResolvedValue({ success: false, error: 'Failed to store the uploaded file.' });
    await withServer(async (base) => {
      const form = new FormData();
      form.append('file', new Blob([pngBytes()], { type: 'image/png' }), 'receipt.png');
      const res = await fetch(`${base}/api/ai/attachments`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(500);
    });
  });
});
