import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

/**
 * Same harness as router.test.ts: a real http server around the real
 * voiceRouter, with only `../authContext` (auth) and the STT/TTS provider
 * factories mocked — audio/text validation (voice/validation.ts) runs for
 * real, so these tests exercise the actual size/MIME/magic-byte gate, not a
 * stand-in for it.
 */
const mocks = vi.hoisted(() => {
  class SttError extends Error {
    category: string;
    constructor(category: string, message: string) {
      super(message);
      this.name = 'SttError';
      this.category = category;
    }
  }
  class SttConfigError extends SttError {
    constructor(message = 'not configured') {
      super('config', message);
      this.name = 'SttConfigError';
    }
  }
  class SttTimeoutError extends SttError {
    constructor(message = 'timed out') {
      super('timeout', message);
      this.name = 'SttTimeoutError';
    }
  }
  class TtsError extends Error {
    category: string;
    constructor(category: string, message: string) {
      super(message);
      this.name = 'TtsError';
      this.category = category;
    }
  }
  class TtsConfigError extends TtsError {
    constructor(message = 'not configured') {
      super('config', message);
      this.name = 'TtsConfigError';
    }
  }
  class TtsTimeoutError extends TtsError {
    constructor(message = 'timed out') {
      super('timeout', message);
      this.name = 'TtsTimeoutError';
    }
  }
  return {
    getCallerContext: vi.fn(),
    log: vi.fn(),
    getSttProvider: vi.fn(),
    getTtsProvider: vi.fn(),
    SttError,
    SttConfigError,
    SttTimeoutError,
    TtsError,
    TtsConfigError,
    TtsTimeoutError,
  };
});

vi.mock('../authContext', () => ({
  SUPABASE_URL: 'http://127.0.0.1:9',
  supabaseAdmin: null,
  log: mocks.log,
  getCallerContext: mocks.getCallerContext,
  callerHasPermission: vi.fn(),
}));

vi.mock('./voice/stt', async () => {
  const actual = await vi.importActual<typeof import('./voice/stt')>('./voice/stt');
  return { ...actual, getSttProvider: mocks.getSttProvider, SttError: mocks.SttError, SttConfigError: mocks.SttConfigError, SttTimeoutError: mocks.SttTimeoutError };
});

vi.mock('./voice/tts', async () => {
  const actual = await vi.importActual<typeof import('./voice/tts')>('./voice/tts');
  return { ...actual, getTtsProvider: mocks.getTtsProvider, TtsError: mocks.TtsError, TtsConfigError: mocks.TtsConfigError, TtsTimeoutError: mocks.TtsTimeoutError };
});

import { voiceRouter } from './voiceRouter';

function makeServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/voice', voiceRouter);
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

function webmBlob(size = 64): Blob {
  const buf = new Uint8Array(size);
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  return new Blob([buf], { type: 'audio/webm' });
}

beforeEach(() => {
  mocks.getCallerContext.mockReset();
  mocks.log.mockReset();
  mocks.getSttProvider.mockReset();
  mocks.getTtsProvider.mockReset();
});

describe('POST /api/ai/voice/transcribe', () => {
  it('401s when there is no valid session, before any file is even parsed', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const form = new FormData();
      form.append('audio', webmBlob(), 'a.webm');
      const res = await fetch(`${base}/api/ai/voice/transcribe`, { method: 'POST', body: form });
      expect(res.status).toBe(401);
      expect(mocks.getSttProvider).not.toHaveBeenCalled();
    });
  });

  it('400s when no audio field is provided', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/transcribe`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x' },
        body: new FormData(),
      });
      expect(res.status).toBe(400);
    });
  });

  it('400s when the uploaded bytes do not match the declared/allowed audio format — never trusts the client MIME alone', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const form = new FormData();
      form.append('audio', new Blob([new Uint8Array(64)], { type: 'audio/webm' }), 'a.webm');
      const res = await fetch(`${base}/api/ai/voice/transcribe`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(400);
      expect(mocks.getSttProvider).not.toHaveBeenCalled();
    });
  });

  it('413s an audio file over the size limit without ever reaching validation or the provider', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
      oversized[0] = 0x1a;
      oversized[1] = 0x45;
      oversized[2] = 0xdf;
      oversized[3] = 0xa3;
      const form = new FormData();
      form.append('audio', new Blob([oversized], { type: 'audio/webm' }), 'a.webm');
      const res = await fetch(`${base}/api/ai/voice/transcribe`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(413);
      expect(mocks.getSttProvider).not.toHaveBeenCalled();
    });
  }, 20000);

  it('503s with a safe message when STT is not configured', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getSttProvider.mockImplementation(() => {
      throw new mocks.SttConfigError('OPENAI_API_KEY is not configured on the server.');
    });
    await withServer(async (base) => {
      const form = new FormData();
      form.append('audio', webmBlob(), 'a.webm');
      const res = await fetch(`${base}/api/ai/voice/transcribe`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).not.toMatch(/OPENAI_API_KEY/);
    });
  });

  it('504s on a provider timeout', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getSttProvider.mockReturnValue({ transcribe: vi.fn().mockRejectedValue(new mocks.SttTimeoutError()) });
    await withServer(async (base) => {
      const form = new FormData();
      form.append('audio', webmBlob(), 'a.webm');
      const res = await fetch(`${base}/api/ai/voice/transcribe`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(504);
    });
  });

  it('502s on a generic provider failure without leaking the underlying error', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getSttProvider.mockReturnValue({ transcribe: vi.fn().mockRejectedValue(new mocks.SttError('request_failed', 'HTTP 500, body: {api-secret-ish}')) });
    await withServer(async (base) => {
      const form = new FormData();
      form.append('audio', webmBlob(), 'a.webm');
      const res = await fetch(`${base}/api/ai/voice/transcribe`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).not.toMatch(/api-secret-ish/);
    });
  });

  it('200s with only a plain transcript string — no separate authorization/tool path is exposed here', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    const transcribe = vi.fn().mockResolvedValue({ text: '  What is the balance for vendor ABC?  ' });
    mocks.getSttProvider.mockReturnValue({ transcribe });
    await withServer(async (base) => {
      const form = new FormData();
      form.append('audio', webmBlob(), 'a.webm');
      form.append('language', 'en');
      const res = await fetch(`${base}/api/ai/voice/transcribe`, { method: 'POST', headers: { Authorization: 'Bearer x' }, body: form });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, transcript: 'What is the balance for vendor ABC?' });
      expect(transcribe.mock.calls[0][1]).toBe('audio/webm');
      expect(transcribe.mock.calls[0][2]).toMatchObject({ language: 'en' });
    });
  });
});

describe('POST /api/ai/voice/synthesize', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hi' }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('400s when "text" is missing or empty', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '   ' }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('400s text over the bounded length — the server bounds this regardless of what the caller sends, never overridable by the client', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(2001) }),
      });
      expect(res.status).toBe(400);
      expect(mocks.getTtsProvider).not.toHaveBeenCalled();
    });
  });

  it('503s with a safe message when TTS is not configured', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getTtsProvider.mockImplementation(() => {
      throw new mocks.TtsConfigError('OPENAI_API_KEY is not configured on the server.');
    });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).not.toMatch(/OPENAI_API_KEY/);
    });
  });

  it('504s on a provider timeout', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getTtsProvider.mockReturnValue({ synthesize: vi.fn().mockRejectedValue(new mocks.TtsTimeoutError()) });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      expect(res.status).toBe(504);
    });
  });

  it('502s on a generic provider failure without leaking the underlying error', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getTtsProvider.mockReturnValue({ synthesize: vi.fn().mockRejectedValue(new mocks.TtsError('request_failed', 'HTTP 500, body: {api-secret-ish}')) });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).not.toMatch(/api-secret-ish/);
    });
  });

  it('200s with the raw audio bytes and matching Content-Type — text fallback is unaffected either way', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    const audio = Buffer.from([1, 2, 3, 4, 5]);
    const synthesize = vi.fn().mockResolvedValue({ audio, mimeType: 'audio/mpeg' });
    mocks.getTtsProvider.mockReturnValue({ synthesize });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Your balance is 100.', voice: 'nova' }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/mpeg');
      const buf = Buffer.from(await res.arrayBuffer());
      expect(Buffer.compare(buf, audio)).toBe(0);
      expect(synthesize.mock.calls[0][1]).toMatchObject({ voice: 'nova' });
    });
  });
});
