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
}));

vi.mock('../authContext', () => ({
  SUPABASE_URL: 'http://127.0.0.1:9',
  supabaseAdmin: null,
  log: mocks.log,
  getCallerContext: mocks.getCallerContext,
  callerHasPermission: mocks.callerHasPermission,
}));

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
});
