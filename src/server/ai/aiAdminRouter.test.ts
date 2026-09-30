import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

const mocks = vi.hoisted(() => ({
  getCallerContext: vi.fn(),
  callerHasPermission: vi.fn(),
  supabaseAdmin: null as any,
  log: vi.fn(),
  createCallerScopedClient: vi.fn(),
  adminRevokePendingAction: vi.fn(),
}));

vi.mock('../authContext', () => ({
  SUPABASE_URL: 'http://127.0.0.1:9',
  get supabaseAdmin() {
    return mocks.supabaseAdmin;
  },
  log: mocks.log,
  getCallerContext: mocks.getCallerContext,
  callerHasPermission: mocks.callerHasPermission,
}));
vi.mock('./db', () => ({ createCallerScopedClient: mocks.createCallerScopedClient }));
vi.mock('./actions/confirmations', () => ({ adminRevokePendingAction: mocks.adminRevokePendingAction }));

import { aiAdminRouter } from './aiAdminRouter';

function makeServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/admin', aiAdminRouter);
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

const MANAGER = { userId: 'admin-1', email: 'admin@example.com', profile: {}, role: { code: 'x', permissions: ['ai_actions.manage'] }, jwt: 'fake-jwt' };

function fakeAdmin(result: { data: any; error: any }) {
  return {
    from: () => ({
      select: () => ({
        order: () => ({ limit: async () => result }),
        eq: () => ({ limit: async () => result }),
      }),
    }),
  };
}

function callerScopedDb(opts: { select?: any; update?: any } = {}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => opts.select ?? { data: [], error: null } }),
          maybeSingle: async () => opts.select ?? { data: null, error: null },
        }),
      }),
      update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => opts.update ?? { data: null, error: null } }) }) }),
    }),
  };
}

beforeEach(() => {
  mocks.getCallerContext.mockReset();
  mocks.callerHasPermission.mockReset();
  mocks.supabaseAdmin = null;
  mocks.log.mockReset();
  mocks.createCallerScopedClient.mockReset();
  mocks.adminRevokePendingAction.mockReset();
});

describe('every route requires ai_actions.manage', () => {
  it('401s without a session on every route', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      for (const path of ['/api/ai/admin/actions', '/api/ai/admin/pending', '/api/ai/admin/kill-switch']) {
        const res = await fetch(`${base}${path}`);
        expect(res.status).toBe(401);
      }
    });
  });

  it('403s a caller who lacks ai_actions.manage, even with a valid session', async () => {
    mocks.getCallerContext.mockResolvedValue({ ...MANAGER, role: { code: 'x', permissions: [] } });
    mocks.callerHasPermission.mockReturnValue(false);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/actions`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(403);
    });
  });
});

describe('GET /actions', () => {
  it('503s when supabaseAdmin is unavailable', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.supabaseAdmin = null;
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/actions`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(503);
    });
  });

  it('200s with the recent-actions list (service-role read — ai_actions has no client select policy)', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.supabaseAdmin = fakeAdmin({ data: [{ id: 'a1', tool_name: 'create_reminder', status: 'executed' }], error: null });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/actions`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.actions).toHaveLength(1);
    });
  });
});

describe('GET /pending', () => {
  it('200s with the caller-scoped list — an ai_actions.manage caller sees every user\'s pending rows via RLS, not a service-role bypass', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue(callerScopedDb({ select: { data: [{ id: 'pa-1' }], error: null } }));
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/pending`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pending).toHaveLength(1);
    });
  });
});

describe('POST /pending/:id/revoke', () => {
  it('404s a nonexistent pending action', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue({});
    mocks.adminRevokePendingAction.mockResolvedValue({ ok: false, reason: 'not_found' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/pending/nope/revoke`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(404);
    });
  });

  it('409s an already-resolved action', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue({});
    mocks.adminRevokePendingAction.mockResolvedValue({ ok: false, reason: 'already_resolved' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/pending/pa-1/revoke`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(409);
    });
  });

  it('200s a successful revoke of ANOTHER user\'s pending action', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue({});
    mocks.adminRevokePendingAction.mockResolvedValue({ ok: true, row: { id: 'pa-1', status: 'rejected' } });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/pending/pa-1/revoke`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
    });
  });
});

describe('GET/PATCH /kill-switch', () => {
  it('GET 200s the current settings', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue(
      callerScopedDb({ select: { data: { actions_enabled: true, automations_enabled: true, disabled_action_tools: [], updated_at: 't' }, error: null } })
    );
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/kill-switch`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.settings.actionsEnabled).toBe(true);
    });
  });

  it('PATCH 400s an invalid field type', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/kill-switch`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionsEnabled: 'yes' }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('PATCH 400s an empty patch', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/kill-switch`, { method: 'PATCH', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });
  });

  it('PATCH 200s a valid toggle — this is the actual server-side kill switch write, RLS-gated by ai_actions.manage on UPDATE', async () => {
    mocks.getCallerContext.mockResolvedValue(MANAGER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue(
      callerScopedDb({ update: { data: { actions_enabled: false, automations_enabled: true, disabled_action_tools: [], updated_at: 't' }, error: null } })
    );
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/admin/kill-switch`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionsEnabled: false }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.settings.actionsEnabled).toBe(false);
    });
  });
});
