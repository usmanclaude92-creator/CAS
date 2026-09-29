import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

/**
 * `../authContext` is mocked so this file can drive the REAL `aiRouter`
 * end-to-end (via an actual http.createServer() + built-in fetch(), no
 * supertest) while controlling auth/authz deterministically. `db.ts` also
 * imports `SUPABASE_URL` from `../authContext`, so the mock supplies an
 * address nothing listens on (127.0.0.1:9) — any tool that reaches the DB
 * layer will fail fast and locally, with no dependency on this sandbox's
 * outbound network policy, exercising the router's "never crash, never leak
 * internals" path. Mocking `../authContext` rather than `../app` is also
 * what keeps this test independent of src/server/app.ts entirely — that
 * file pulls in aiRouter itself, so mocking it here would recreate the very
 * cycle authContext.ts exists to avoid (see src/server/authContext.ts).
 */
const mocks = vi.hoisted(() => ({
  getCallerContext: vi.fn(),
  callerHasPermission: vi.fn(),
  log: vi.fn(),
  runAiChat: vi.fn(),
  getConversation: vi.fn(),
  listRecentMessages: vi.fn(),
}));

vi.mock('../authContext', () => ({
  SUPABASE_URL: 'http://127.0.0.1:9',
  supabaseAdmin: null,
  log: mocks.log,
  getCallerContext: mocks.getCallerContext,
  callerHasPermission: mocks.callerHasPermission,
}));

// This sandbox has no real SUPABASE_ANON_KEY configured, so the real
// createCallerScopedClient() throws synchronously ("supabaseKey is
// required") before any of the mocked runAiChat/getConversation logic below
// would even run. Router-level tests here only need a caller-scoped client
// to exist and be passed through — its actual query behavior is covered by
// runtime.test.ts/conversations.test.ts against a real fake-db harness — so
// a stub is enough, and it keeps this file's coverage of the client
// misconfiguration path (via the legacy tool contract's own try/catch,
// still exercised for real below) identical to before this mock existed.
vi.mock('./db', () => ({ createCallerScopedClient: vi.fn(() => ({})) }));

// The router-level tests below exercise routing/status-mapping/pre-checks
// only — runAiChat itself is covered end-to-end (real registry, real
// permission checks, real conversation persistence against a fake db) in
// runtime.test.ts, so it's mocked here rather than duplicated.
vi.mock('./runtime', async () => {
  const actual = await vi.importActual<typeof import('./runtime')>('./runtime');
  return { ...actual, runAiChat: mocks.runAiChat };
});

// Likewise, conversations.ts's own read-your-own-write/ownership behavior
// is covered in conversations.test.ts — mocked here to isolate the router's
// own auth-then-lookup wiring for GET /conversations/:id/messages.
vi.mock('./conversations', async () => {
  const actual = await vi.importActual<typeof import('./conversations')>('./conversations');
  return { ...actual, getConversation: mocks.getConversation, listRecentMessages: mocks.listRecentMessages };
});

import { aiRouter } from './router';

function makeServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
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

const CALLER = {
  userId: 'user-1',
  email: 'test@example.com',
  profile: { status: 'active' },
  role: { code: 'viewer', permissions: ['vendors.view'] },
  jwt: 'fake-jwt',
};

beforeEach(() => {
  mocks.getCallerContext.mockReset();
  mocks.callerHasPermission.mockReset();
  mocks.log.mockReset();
  mocks.runAiChat.mockReset();
  mocks.getConversation.mockReset();
  mocks.listRecentMessages.mockReset();
});

describe('GET /api/ai/tools', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/tools`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  it('lists only the tools the caller holds permission for — never listed-then-refused', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockImplementation((_caller: unknown, perm: string) => perm === 'vendors.view');
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/tools`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      const names = body.tools.map((t: any) => t.name);
      expect(names).toContain('get_vendors');
      expect(names).not.toContain('get_clients');
    });
  });
});

describe('POST /api/ai/chat', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'get_vendors', arguments: {} }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('400s for an unknown tool name — never falls back to arbitrary data access', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/chat`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'drop_table_vendors', arguments: {} }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  it('400s when the "tool" field is missing entirely', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/chat`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ arguments: {} }),
      });
      expect(res.status).toBe(400);
    });
  });

  it("403s when the caller lacks the tool's required permission — never executes the tool", async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(false);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/chat`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'get_vendors', arguments: {} }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/vendors\.view/);
    });
  });

  it('400s for invalid arguments after permission passes — arg validation runs before any DB call', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(true);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/chat`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        // get_vendor_details requires vendorId or vendorName — neither given.
        body: JSON.stringify({ tool: 'get_vendor_details', arguments: {} }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('a fully authorized, well-formed dispatch never crashes or leaks internals even when the downstream DB call fails', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(true);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/chat`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'get_vendors', arguments: {} }),
      });
      // The mocked SUPABASE_URL (127.0.0.1:9) can never be reached, so the
      // tool's DB call fails — the router must still answer safely: uniform
      // 200 + { success:false, error: <safe string> }, per the router's own
      // documented contract (401/400/403 are reserved for the gates above
      // tool execution).
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe('string');
      expect(body.error).not.toMatch(/ECONNREFUSED|stack|at Object|node_modules/i);
    });
  });

  describe('message contract ({ message, conversationId? })', () => {
    it('401s when there is no valid session, same as the tool contract', async () => {
      mocks.getCallerContext.mockResolvedValue(null);
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello' }),
        });
        expect(res.status).toBe(401);
        expect(mocks.runAiChat).not.toHaveBeenCalled();
      });
    });

    it('400s an over-length message before ever calling the runtime', async () => {
      mocks.getCallerContext.mockResolvedValue(CALLER);
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'x'.repeat(5000) }),
        });
        expect(res.status).toBe(400);
        expect(mocks.runAiChat).not.toHaveBeenCalled();
      });
    });

    it('400s when neither "tool" nor "message" is present', async () => {
      mocks.getCallerContext.mockResolvedValue(CALLER);
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
      });
    });

    it('returns 200 with reply/conversationId/toolActivity/sources on success', async () => {
      mocks.getCallerContext.mockResolvedValue(CALLER);
      mocks.runAiChat.mockResolvedValue({
        success: true,
        conversationId: 'conv-1',
        reply: 'Your outstanding balance is 100.',
        toolActivity: [{ label: 'Checking vendor balance…' }],
        sources: [{ sourceId: 'src-1', title: 'CAS Accounting Workflow' }],
      });
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'What is vendor xyz outstanding balance?' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({
          success: true,
          conversationId: 'conv-1',
          reply: 'Your outstanding balance is 100.',
          toolActivity: [{ label: 'Checking vendor balance…' }],
          sources: [{ sourceId: 'src-1', title: 'CAS Accounting Workflow' }],
        });
      });
    });

    it.each([
      ['invalid_request', 400],
      ['conversation_not_found', 404],
      ['provider_config', 503],
      ['provider_timeout', 504],
      ['provider_failure', 502],
      ['internal_error', 500],
    ])('maps runAiChat error category "%s" to HTTP %i', async (category, expectedStatus) => {
      mocks.getCallerContext.mockResolvedValue(CALLER);
      mocks.runAiChat.mockResolvedValue({ success: false, category, error: 'Safe message.' });
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello' }),
        });
        expect(res.status).toBe(expectedStatus);
        const body = await res.json();
        expect(body).toEqual({ success: false, error: 'Safe message.' });
      });
    });

    it('never crashes or leaks internals if runAiChat itself throws', async () => {
      mocks.getCallerContext.mockResolvedValue(CALLER);
      mocks.runAiChat.mockRejectedValue(new Error('unexpected internal failure with sensitive detail'));
      await withServer(async (base) => {
        const res = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello' }),
        });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).not.toMatch(/sensitive detail/);
      });
    });
  });
});

describe('GET /api/ai/conversations/:id/messages', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/conversations/conv-1/messages`);
      expect(res.status).toBe(401);
      expect(mocks.getConversation).not.toHaveBeenCalled();
    });
  });

  it('404s for a conversation that does not exist or belongs to another user — same response either way, never confirms existence', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getConversation.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/conversations/not-mine/messages`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(404);
      expect(mocks.listRecentMessages).not.toHaveBeenCalled();
    });
  });

  it('200s with the message history for a conversation the caller owns', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getConversation.mockResolvedValue({ id: 'conv-1', user_id: 'user-1', title: null, created_at: 't', updated_at: 't' });
    mocks.listRecentMessages.mockResolvedValue([
      { id: 'm1', conversation_id: 'conv-1', role: 'user', content: 'hi', provider: null, model: null, created_at: 't1' },
      { id: 'm2', conversation_id: 'conv-1', role: 'assistant', content: 'hello', provider: 'anthropic', model: 'x', created_at: 't2' },
    ]);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/conversations/conv-1/messages`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.conversationId).toBe('conv-1');
      expect(body.messages).toEqual([
        { role: 'user', content: 'hi', createdAt: 't1' },
        { role: 'assistant', content: 'hello', createdAt: 't2' },
      ]);
    });
  });
});
