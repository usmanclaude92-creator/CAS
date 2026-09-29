import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

const mocks = vi.hoisted(() => ({
  getCallerContext: vi.fn(),
  callerHasPermission: vi.fn(),
  supabaseAdmin: null as any,
  log: vi.fn(),
  createCallerScopedClient: vi.fn(),
  areAutomationsEnabled: vi.fn(),
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
vi.mock('./actions/killSwitch', () => ({ areAutomationsEnabled: mocks.areAutomationsEnabled }));

import { automationsRouter } from './automationsRouter';

function makeServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/automations', automationsRouter);
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

const CALLER = { userId: 'user-1', email: 'test@example.com', profile: {}, role: { code: 'x', permissions: [] }, jwt: 'fake-jwt' };
const VALID_BODY = { name: 'Weekly check', notifyTitle: 'Reminder', notifyMessage: 'Review pending approvals.', intervalHours: 168 };

function makeCallerScopedDb(opts: { insertResult?: any; updateResult?: any; deleteResult?: any; listResult?: any } = {}) {
  return {
    from: (table: string) => {
      if (table !== 'ai_automations') throw new Error(`unexpected table ${table}`);
      return {
        insert: (row: any) => ({
          select: () => ({ single: async () => opts.insertResult ?? { data: { id: 'auto-1', ...row, created_at: 't', updated_at: 't', next_run_at: 't' }, error: null } }),
        }),
        select: () => ({ order: async () => opts.listResult ?? { data: [], error: null } }),
        update: (patch: any) => ({
          eq: () => ({
            select: () => ({ maybeSingle: async () => opts.updateResult ?? { data: { id: 'auto-1', ...patch }, error: null } }),
          }),
        }),
        delete: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => opts.deleteResult ?? { data: { id: 'auto-1' }, error: null } }) }) }),
      };
    },
  };
}

beforeEach(() => {
  mocks.getCallerContext.mockReset();
  mocks.callerHasPermission.mockReset();
  mocks.supabaseAdmin = null;
  mocks.log.mockReset();
  mocks.createCallerScopedClient.mockReset();
  mocks.areAutomationsEnabled.mockReset().mockResolvedValue(true);
  delete process.env.CRON_SECRET;
});

describe('POST /api/ai/automations', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(VALID_BODY) });
      expect(res.status).toBe(401);
    });
  });

  it('403s without ai_actions.use — checked BEFORE any DB write', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(false);
    mocks.createCallerScopedClient.mockReturnValue(makeCallerScopedDb());
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations`, { method: 'POST', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify(VALID_BODY) });
      expect(res.status).toBe(403);
    });
  });

  it('400s an out-of-range intervalHours — execution-frequency limit enforced server-side', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue(makeCallerScopedDb());
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_BODY, intervalHours: 0 }),
      });
      expect(res.status).toBe(400);
    });
  });

  it('201s and creates a "notify"-kind automation for authorized callers', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.callerHasPermission.mockReturnValue(true);
    mocks.createCallerScopedClient.mockReturnValue(makeCallerScopedDb());
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations`, { method: 'POST', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify(VALID_BODY) });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.automation.id).toBe('auto-1');
    });
  });
});

describe('GET /api/ai/automations', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations`, { headers: {} });
      expect(res.status).toBe(401);
    });
  });
});

describe('PATCH /api/ai/automations/:id', () => {
  it('404s for a nonexistent/not-owned automation — RLS scoping means the update simply matches nothing', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.createCallerScopedClient.mockReturnValue(makeCallerScopedDb({ updateResult: { data: null, error: null } }));
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations/not-mine`, { method: 'PATCH', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
      expect(res.status).toBe(404);
    });
  });

  it('400s when no updatable field is provided', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.createCallerScopedClient.mockReturnValue(makeCallerScopedDb());
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations/auto-1`, { method: 'PATCH', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });
  });
});

describe('DELETE /api/ai/automations/:id', () => {
  it('404s for a nonexistent/not-owned automation', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.createCallerScopedClient.mockReturnValue(makeCallerScopedDb({ deleteResult: { data: null, error: null } }));
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations/not-mine`, { method: 'DELETE', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(404);
    });
  });
});

// --- GET /run-due — Vercel Cron's entry point --------------------------------

function makeFakeAdmin(opts: { due?: any[]; ownerActive?: boolean; notifyError?: any } = {}) {
  const runsInserted: any[] = [];
  const runsUpdated: any[] = [];
  const automationUpdates: any[] = [];
  const notificationsInserted: any[] = [];

  return {
    from(table: string) {
      if (table === 'ai_automations') {
        return {
          select: () => ({ eq: () => ({ lte: () => ({ limit: async () => ({ data: opts.due ?? [], error: null }) }) }) }),
          update: (patch: any) => ({
            eq: (_field: string, value: any) => {
              automationUpdates.push({ patch, id: value });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === 'ai_automation_runs') {
        return {
          insert: (row: any) => {
            runsInserted.push(row);
            return { select: () => ({ single: async () => ({ data: { id: `run-${runsInserted.length}` }, error: null }) }) };
          },
          update: (patch: any) => ({
            eq: (_field: string, value: any) => {
              runsUpdated.push({ patch, id: value });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: opts.ownerActive === false ? 'inactive' : 'active' }, error: null }) }) }) };
      }
      if (table === 'notifications') {
        return {
          insert: async (row: any) => {
            notificationsInserted.push(row);
            return { data: null, error: opts.notifyError ?? null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    _runsInserted: runsInserted,
    _runsUpdated: runsUpdated,
    _automationUpdates: automationUpdates,
    _notificationsInserted: notificationsInserted,
  };
}

const DUE_AUTOMATION = {
  id: 'auto-1',
  owner_user_id: 'user-1',
  notify_title: 'Reminder',
  notify_message: 'Check approvals.',
  interval_hours: 24,
  enabled: true,
  consecutive_failure_count: 0,
  max_consecutive_failures: 5,
};

describe('GET /api/ai/automations/run-due — Vercel Cron entry point', () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('503s when CRON_SECRET is not configured — refuses to run unauthenticated', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations/run-due`);
      expect(res.status).toBe(503);
    });
  });

  it('401s a request without the correct bearer secret', async () => {
    process.env.CRON_SECRET = 'the-real-secret';
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations/run-due`, { headers: { Authorization: 'Bearer wrong-guess' } });
      expect(res.status).toBe(401);
    });
  });

  it('skips running anything when automations are globally disabled (kill switch)', async () => {
    process.env.CRON_SECRET = 'secret';
    mocks.supabaseAdmin = makeFakeAdmin({ due: [DUE_AUTOMATION] });
    mocks.areAutomationsEnabled.mockResolvedValue(false);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations/run-due`, { headers: { Authorization: 'Bearer secret' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ran).toBe(0);
      expect(mocks.supabaseAdmin._notificationsInserted).toHaveLength(0);
    });
  });

  it('runs a due, enabled automation: sends the notification, resets the failure count, and reschedules next_run_at', async () => {
    process.env.CRON_SECRET = 'secret';
    const admin = makeFakeAdmin({ due: [DUE_AUTOMATION] });
    mocks.supabaseAdmin = admin;
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/automations/run-due`, { headers: { Authorization: 'Bearer secret' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ran).toBe(1);
    });
    expect(admin._notificationsInserted).toHaveLength(1);
    expect(admin._notificationsInserted[0]).toMatchObject({ user_id: 'user-1', title: 'Reminder', message: 'Check approvals.' });
    expect(admin._automationUpdates[0].patch.consecutive_failure_count).toBe(0);
    expect(admin._runsUpdated[0].patch.status).toBe('succeeded');
  });

  it('skips (as a failure) an automation whose owner is no longer an active user — "unauthorized automation execution" is refused, not silently run', async () => {
    process.env.CRON_SECRET = 'secret';
    const admin = makeFakeAdmin({ due: [DUE_AUTOMATION], ownerActive: false });
    mocks.supabaseAdmin = admin;
    await withServer(async (base) => {
      await fetch(`${base}/api/ai/automations/run-due`, { headers: { Authorization: 'Bearer secret' } });
    });
    expect(admin._notificationsInserted).toHaveLength(0);
    expect(admin._runsUpdated[0].patch.status).toBe('failed');
    expect(admin._automationUpdates[0].patch.consecutive_failure_count).toBe(1);
  });

  it('increments the failure counter on a notification-insert failure, and auto-disables once max_consecutive_failures is reached — the per-automation kill switch', async () => {
    process.env.CRON_SECRET = 'secret';
    const admin = makeFakeAdmin({ due: [{ ...DUE_AUTOMATION, consecutive_failure_count: 4, max_consecutive_failures: 5 }], notifyError: { message: 'insert failed' } });
    mocks.supabaseAdmin = admin;
    await withServer(async (base) => {
      await fetch(`${base}/api/ai/automations/run-due`, { headers: { Authorization: 'Bearer secret' } });
    });
    expect(admin._automationUpdates[0].patch.consecutive_failure_count).toBe(5);
    expect(admin._automationUpdates[0].patch.enabled).toBe(false); // auto-disabled at the ceiling
  });

  it('does not disable an automation whose failure count is still under the ceiling', async () => {
    process.env.CRON_SECRET = 'secret';
    const admin = makeFakeAdmin({ due: [{ ...DUE_AUTOMATION, consecutive_failure_count: 1, max_consecutive_failures: 5 }], notifyError: { message: 'transient' } });
    mocks.supabaseAdmin = admin;
    await withServer(async (base) => {
      await fetch(`${base}/api/ai/automations/run-due`, { headers: { Authorization: 'Bearer secret' } });
    });
    expect(admin._automationUpdates[0].patch.enabled).toBe(true);
  });
});
