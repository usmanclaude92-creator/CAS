import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

/**
 * Same real-http-server harness as router.test.ts/voiceRouter.test.ts —
 * `../authContext` mocked for deterministic auth, `./db` mocked to avoid a
 * live Supabase connection, confirmations.ts and dispatch.ts mocked since
 * each has its own dedicated test file; this file isolates the ROUTER's own
 * status-code mapping and request/response wiring.
 */
const mocks = vi.hoisted(() => ({
  getCallerContext: vi.fn(),
  log: vi.fn(),
  createCallerScopedClient: vi.fn(() => ({})),
  claimPendingActionForExecution: vi.fn(),
  markRejected: vi.fn(),
  recordExecutionOutcome: vi.fn(async () => {}),
  getOwnedPendingAction: vi.fn(),
  executeConfirmedAction: vi.fn(),
}));

vi.mock('../authContext', () => ({
  SUPABASE_URL: 'http://127.0.0.1:9',
  supabaseAdmin: null,
  log: mocks.log,
  getCallerContext: mocks.getCallerContext,
  callerHasPermission: vi.fn(),
}));
vi.mock('./db', () => ({ createCallerScopedClient: mocks.createCallerScopedClient }));
vi.mock('./actions/confirmations', () => ({
  claimPendingActionForExecution: mocks.claimPendingActionForExecution,
  markRejected: mocks.markRejected,
  recordExecutionOutcome: mocks.recordExecutionOutcome,
  getOwnedPendingAction: mocks.getOwnedPendingAction,
}));
vi.mock('./actions/dispatch', () => ({ executeConfirmedAction: mocks.executeConfirmedAction }));

import { actionsRouter } from './actionsRouter';

function makeServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/actions', actionsRouter);
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
const PENDING_ROW = { id: 'pa-1', tool_name: 'create_reminder', user_id: 'user-1' };

beforeEach(() => {
  mocks.getCallerContext.mockReset();
  mocks.log.mockReset();
  mocks.claimPendingActionForExecution.mockReset();
  mocks.markRejected.mockReset();
  mocks.recordExecutionOutcome.mockReset().mockResolvedValue(undefined);
  mocks.getOwnedPendingAction.mockReset();
  mocks.executeConfirmedAction.mockReset();
});

describe('POST /api/ai/actions/:id/confirm', () => {
  it('401s when there is no valid session — before ever touching the pending row', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/confirm`, { method: 'POST' });
      expect(res.status).toBe(401);
      expect(mocks.claimPendingActionForExecution).not.toHaveBeenCalled();
    });
  });

  it('404s for a nonexistent confirmation id', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.claimPendingActionForExecution.mockResolvedValue({ ok: false, reason: 'not_found' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/nope/confirm`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(404);
    });
  });

  it('409s a replayed confirmation (already resolved) — never executes twice', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.claimPendingActionForExecution.mockResolvedValue({ ok: false, reason: 'already_resolved' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/confirm`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(409);
      expect(mocks.executeConfirmedAction).not.toHaveBeenCalled();
    });
  });

  it('410s an expired confirmation', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.claimPendingActionForExecution.mockResolvedValue({ ok: false, reason: 'expired' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/confirm`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(410);
    });
  });

  it("ignores any body sent with the confirm request — a caller cannot change what executes by sending different arguments", async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.claimPendingActionForExecution.mockResolvedValue({ ok: true, row: PENDING_ROW });
    mocks.executeConfirmedAction.mockResolvedValue({ ok: true, data: { id: 'notif-1' } });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/confirm`, {
        method: 'POST',
        headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: { amount: 999999 }, vendorId: 'attacker-controlled' }),
      });
      expect(res.status).toBe(200);
      // executeConfirmedAction is called only with (caller, db, claimedRow) —
      // the request body is never read anywhere in this route.
      expect(mocks.executeConfirmedAction).toHaveBeenCalledWith(CALLER, expect.anything(), PENDING_ROW);
    });
  });

  it('200s with success:false (never a 5xx) when execution fails after a valid claim, and records the outcome', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.claimPendingActionForExecution.mockResolvedValue({ ok: true, row: PENDING_ROW });
    mocks.executeConfirmedAction.mockResolvedValue({ ok: false, error: 'Vendor not found.' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/confirm`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: false, error: 'Vendor not found.' });
      expect(mocks.recordExecutionOutcome).toHaveBeenCalledWith(expect.anything(), 'pa-1', 'user-1', false, { error: 'Vendor not found.' });
    });
  });

  it('200s with the real result on success and records the outcome as succeeded', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.claimPendingActionForExecution.mockResolvedValue({ ok: true, row: PENDING_ROW });
    mocks.executeConfirmedAction.mockResolvedValue({ ok: true, data: { id: 'notif-1' }, affectedResource: { table: 'notifications', id: 'notif-1' } });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/confirm`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, data: { id: 'notif-1' }, affectedResource: { table: 'notifications', id: 'notif-1' } });
      expect(mocks.recordExecutionOutcome).toHaveBeenCalledWith(expect.anything(), 'pa-1', 'user-1', true, { data: { id: 'notif-1' }, affectedResource: { table: 'notifications', id: 'notif-1' } });
    });
  });

  it('500s safely and records failure if executeConfirmedAction itself throws', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.claimPendingActionForExecution.mockResolvedValue({ ok: true, row: PENDING_ROW });
    mocks.executeConfirmedAction.mockRejectedValue(new Error('unexpected internal failure with sensitive detail'));
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/confirm`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).not.toMatch(/sensitive detail/);
      expect(mocks.recordExecutionOutcome).toHaveBeenCalled();
    });
  });
});

describe('POST /api/ai/actions/:id/reject', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/reject`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  it('never executes the tool — reject and confirm are mutually exclusive code paths', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.markRejected.mockResolvedValue({ ok: true, row: { ...PENDING_ROW, status: 'rejected' } });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/reject`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      expect(mocks.executeConfirmedAction).not.toHaveBeenCalled();
    });
  });

  it('409s a reject-after-already-resolved', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.markRejected.mockResolvedValue({ ok: false, reason: 'already_resolved' });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1/reject`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(409);
    });
  });
});

describe('GET /api/ai/actions/:id', () => {
  it('401s when there is no valid session', async () => {
    mocks.getCallerContext.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1`);
      expect(res.status).toBe(401);
    });
  });

  it('404s for a nonexistent/not-owned action — never confirms existence either way', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getOwnedPendingAction.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(404);
    });
  });

  it('200s with the preview/status metadata but NEVER the raw validated args — those are server-internal', async () => {
    mocks.getCallerContext.mockResolvedValue(CALLER);
    mocks.getOwnedPendingAction.mockResolvedValue({
      id: 'pa-1',
      tool_name: 'create_direct_expense',
      risk_level: 'high',
      category: 'create',
      args: { amount: 250, accountId: 'secret-internal-id' },
      preview: { summary: 'Post an expense', fields: [] },
      status: 'pending',
      created_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2026-01-01T00:15:00.000Z',
    });
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/ai/actions/pa-1`, { headers: { Authorization: 'Bearer x' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.action).toEqual({
        confirmationId: 'pa-1',
        toolName: 'create_direct_expense',
        riskLevel: 'high',
        category: 'create',
        preview: { summary: 'Post an expense', fields: [] },
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-01T00:15:00.000Z',
      });
      expect(JSON.stringify(body)).not.toMatch(/secret-internal-id/);
    });
  });
});
