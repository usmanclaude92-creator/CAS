import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallerContext } from '../../authContext';

/**
 * Isolates dispatch.ts's OWN orchestration logic (permission gate, kill
 * switch, validation, preview, confirm-vs-execute branching, audit calls)
 * from the real registry/killSwitch/confirmations/audit modules — each of
 * those has its own dedicated test file. Mirrors runtime.test.ts's own
 * mocking discipline.
 */
const mocks = vi.hoisted(() => ({
  getActionTool: vi.fn(),
  isActionToolAvailable: vi.fn(),
  createPendingAction: vi.fn(),
  recordAiAction: vi.fn(async () => {}),
}));

vi.mock('../actionRegistry', () => ({ getActionTool: mocks.getActionTool }));
vi.mock('./killSwitch', () => ({ isActionToolAvailable: mocks.isActionToolAvailable }));
vi.mock('./confirmations', () => ({
  createPendingAction: mocks.createPendingAction,
  fingerprintArgs: (args: unknown) => `fp:${JSON.stringify(args)}`,
}));
vi.mock('./audit', () => ({ recordAiAction: mocks.recordAiAction, newCorrelationId: () => 'corr-1' }));

import { executeActionToolCall, executeConfirmedAction } from './dispatch';

function caller(overrides: Partial<CallerContext> = {}): CallerContext {
  return { userId: 'user-1', email: 'test@example.com', profile: {}, role: { code: 'x', permissions: ['test.permission'] }, jwt: 'fake-jwt', ...overrides };
}

function fakeTool(overrides: any = {}) {
  return {
    name: 'test_action',
    description: 'A test action.',
    requiredPermission: 'test.permission',
    category: 'create',
    riskLevel: 'low',
    transactional: true,
    requiresConfirmation: false,
    validateArgs: vi.fn((raw: any) => ({ ok: true, args: raw })),
    buildPreview: vi.fn(async () => ({ ok: true, summary: 'Do the thing', entityType: 'thing', fields: [], irreversible: false })),
    handler: vi.fn(async () => ({ status: 'executed', data: { id: 'result-1' }, affectedResource: { table: 'things', id: 'result-1' } })),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getActionTool.mockReset();
  mocks.isActionToolAvailable.mockReset().mockResolvedValue({ enabled: true });
  mocks.createPendingAction.mockReset();
  mocks.recordAiAction.mockReset().mockResolvedValue(undefined);
});

describe('executeActionToolCall — propose/immediate-execute path', () => {
  it('returns a clean error for an unknown tool name, without touching permission/kill-switch/audit', async () => {
    mocks.getActionTool.mockReturnValue(undefined);
    const outcome = await executeActionToolCall(caller(), {} as any, 'nonexistent_tool', {}, 'conv-1');
    expect(outcome.isError).toBe(true);
    expect(outcome.toolResultPayload).toEqual({ success: false, error: 'Unknown action "nonexistent_tool".' });
    expect(mocks.recordAiAction).not.toHaveBeenCalled();
  });

  it('rejects a call from a caller lacking the required permission, without calling validateArgs/buildPreview/handler at all', async () => {
    const tool = fakeTool();
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeActionToolCall(caller({ role: { code: 'x', permissions: [] } }), {} as any, 'test_action', {}, 'conv-1');

    expect(outcome.isError).toBe(true);
    expect(outcome.toolResultPayload.error).toMatch(/Forbidden/);
    expect(tool.validateArgs).not.toHaveBeenCalled();
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'authorization_failed', toolName: 'test_action' }));
  });

  it('refuses when the kill switch (or per-tool disable) says the tool is unavailable, surfacing the server-given reason', async () => {
    const tool = fakeTool();
    mocks.getActionTool.mockReturnValue(tool);
    mocks.isActionToolAvailable.mockResolvedValue({ enabled: false, reason: 'AI actions are temporarily disabled by an administrator.' });

    const outcome = await executeActionToolCall(caller(), {} as any, 'test_action', {}, 'conv-1');
    expect(outcome.isError).toBe(true);
    expect(outcome.toolResultPayload.error).toBe('AI actions are temporarily disabled by an administrator.');
    expect(tool.validateArgs).not.toHaveBeenCalled();
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'authorization_failed' }));
  });

  it('rejects invalid arguments without ever calling buildPreview or handler', async () => {
    const tool = fakeTool({ validateArgs: vi.fn(() => ({ ok: false, error: 'amount must be positive' })) });
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeActionToolCall(caller(), {} as any, 'test_action', { amount: -1 }, 'conv-1');

    expect(outcome.isError).toBe(true);
    expect(outcome.toolResultPayload.error).toBe('amount must be positive');
    expect(tool.buildPreview).not.toHaveBeenCalled();
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'validation_failed' }));
  });

  it('surfaces a preview-level failure (e.g. "vendor not found") as validation_failed, never executing the handler', async () => {
    const tool = fakeTool({ buildPreview: vi.fn(async () => ({ ok: false, error: 'Vendor not found.' })) });
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeActionToolCall(caller(), {} as any, 'test_action', {}, 'conv-1');

    expect(outcome.isError).toBe(true);
    expect(outcome.toolResultPayload.error).toBe('Vendor not found.');
    expect(tool.handler).not.toHaveBeenCalled();
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'validation_failed' }));
  });

  it('a confirmation-required tool NEVER calls its handler — it only creates a pending row and returns confirmation_required', async () => {
    const tool = fakeTool({ requiresConfirmation: true, riskLevel: 'high' });
    mocks.getActionTool.mockReturnValue(tool);
    mocks.createPendingAction.mockResolvedValue({ id: 'pa-1', expires_at: '2026-01-01T00:20:00.000Z' });

    const outcome = await executeActionToolCall(caller(), {} as any, 'test_action', {}, 'conv-1');

    expect(tool.handler).not.toHaveBeenCalled();
    expect(outcome.isError).toBe(false);
    expect(outcome.toolResultPayload).toEqual({ success: true, data: { status: 'confirmation_required', confirmationId: 'pa-1', summary: 'Do the thing' } });
    expect(outcome.pendingAction).toEqual({
      confirmationId: 'pa-1',
      toolName: 'test_action',
      riskLevel: 'high',
      category: 'create',
      preview: { ok: true, summary: 'Do the thing', entityType: 'thing', fields: [], irreversible: false },
      expiresAt: '2026-01-01T00:20:00.000Z',
    });
    // No ai_actions row here — ai_pending_actions IS the proposal-time audit record.
    expect(mocks.recordAiAction).not.toHaveBeenCalled();
  });

  it('reports a clean error if the pending row could not be created, still never executing the handler', async () => {
    const tool = fakeTool({ requiresConfirmation: true });
    mocks.getActionTool.mockReturnValue(tool);
    mocks.createPendingAction.mockResolvedValue(null);

    const outcome = await executeActionToolCall(caller(), {} as any, 'test_action', {}, 'conv-1');
    expect(outcome.isError).toBe(true);
    expect(tool.handler).not.toHaveBeenCalled();
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'execution_failed' }));
  });

  it('a low-risk, no-confirmation tool executes immediately and records success', async () => {
    const tool = fakeTool();
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeActionToolCall(caller(), {} as any, 'test_action', {}, 'conv-1');

    expect(tool.handler).toHaveBeenCalledTimes(1);
    expect(outcome.isError).toBe(false);
    expect(outcome.toolResultPayload).toEqual({ success: true, data: { id: 'result-1' } });
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'executed', confirmationStatus: 'not_required' }));
  });

  it('the model can never infer success merely because the call was accepted — a non-"executed" handler outcome is reported as a clean failure', async () => {
    const tool = fakeTool({ handler: vi.fn(async () => ({ status: 'execution_failed', error: 'RPC unique-key collision.' })) });
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeActionToolCall(caller(), {} as any, 'test_action', {}, 'conv-1');

    expect(outcome.isError).toBe(true);
    expect(outcome.toolResultPayload.error).toBe('RPC unique-key collision.');
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'execution_failed' }));
  });

  it('a handler that hangs past the timeout is reported as a timeout, not left hanging or silently treated as success', async () => {
    vi.useFakeTimers();
    try {
      const tool = fakeTool({ handler: vi.fn(() => new Promise(() => {})) });
      mocks.getActionTool.mockReturnValue(tool);
      const outcomePromise = executeActionToolCall(caller(), {} as any, 'test_action', {}, 'conv-1');
      await vi.advanceTimersByTimeAsync(15_000);
      const outcome = await outcomePromise;
      expect(outcome.isError).toBe(true);
      expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'timeout' }));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('executeConfirmedAction — the confirmed-execution path', () => {
  const pendingRow = {
    id: 'pa-1',
    user_id: 'user-1',
    conversation_id: 'conv-1',
    tool_name: 'test_action',
    risk_level: 'high' as const,
    category: 'create' as const,
    required_permission: 'test.permission',
    args: { amount: 250 },
    args_fingerprint: 'fp',
    preview: { ok: true, summary: '', entityType: 'thing', fields: [], irreversible: false },
    status: 'processing' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    expires_at: '2026-01-01T00:15:00.000Z',
    resolved_at: null,
    execution_result: null,
  };

  it('fails cleanly if the tool is no longer registered', async () => {
    mocks.getActionTool.mockReturnValue(undefined);
    const outcome = await executeConfirmedAction(caller(), {} as any, pendingRow);
    expect(outcome).toEqual({ ok: false, error: 'This action is no longer available.' });
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'execution_failed', confirmationStatus: 'confirmed' }));
  });

  it('re-checks permission fresh at confirmation time — a permission revoked since proposal blocks execution', async () => {
    mocks.getActionTool.mockReturnValue(fakeTool());
    const outcome = await executeConfirmedAction(caller({ role: { code: 'x', permissions: [] } }), {} as any, pendingRow);
    expect(outcome.ok).toBe(false);
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'authorization_failed', confirmationStatus: 'confirmed' }));
  });

  it('re-checks the kill switch fresh at confirmation time', async () => {
    mocks.getActionTool.mockReturnValue(fakeTool());
    mocks.isActionToolAvailable.mockResolvedValue({ enabled: false, reason: 'Disabled.' });
    const outcome = await executeConfirmedAction(caller(), {} as any, pendingRow);
    expect(outcome).toEqual({ ok: false, error: 'Disabled.' });
  });

  it('re-validates the STORED arguments (defense in depth) before executing', async () => {
    const tool = fakeTool({ validateArgs: vi.fn(() => ({ ok: false, error: 'no longer valid' })) });
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeConfirmedAction(caller(), {} as any, pendingRow);
    expect(outcome).toEqual({ ok: false, error: 'no longer valid' });
    expect(tool.handler).not.toHaveBeenCalled();
  });

  it('executes the handler with the stored args and reports success with the real result', async () => {
    const tool = fakeTool();
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeConfirmedAction(caller(), {} as any, pendingRow);

    expect(tool.handler.mock.calls[0][1]).toEqual(pendingRow.args);
    expect(outcome).toEqual({ ok: true, data: { id: 'result-1' }, affectedResource: { table: 'things', id: 'result-1' } });
    expect(mocks.recordAiAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'executed', confirmationStatus: 'confirmed', pendingActionId: 'pa-1' }));
  });

  it('reports a clean failure, never a false success, when the handler itself reports failure', async () => {
    const tool = fakeTool({ handler: vi.fn(async () => ({ status: 'execution_failed', error: 'Insufficient account balance.' })) });
    mocks.getActionTool.mockReturnValue(tool);
    const outcome = await executeConfirmedAction(caller(), {} as any, pendingRow);
    expect(outcome).toEqual({ ok: false, error: 'Insufficient account balance.' });
  });
});
