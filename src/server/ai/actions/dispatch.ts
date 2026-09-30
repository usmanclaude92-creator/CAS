import type { SupabaseClient } from '@supabase/supabase-js';
import { callerHasPermission, log, type CallerContext } from '../../authContext.js';
import { getActionTool } from '../actionRegistry.js';
import { actionToolActivityLabel } from '../actionToolActivityLabels.js';
import type { ActionCategory, ActionRiskLevel, ActionToolExecutionContext, PendingActionSummary } from './types.js';
import { createPendingAction, fingerprintArgs, type PendingActionRow } from './confirmations.js';
import { recordAiAction, newCorrelationId, type AiActionAuditStatus } from './audit.js';
import { isActionToolAvailable } from './killSwitch.js';

/**
 * The action-tool execution engine — everything a proposed OR confirmed
 * action call goes through, shared between runtime.ts's tool-use loop (the
 * propose/immediate-execute path) and actionsRouter.ts's confirm endpoint
 * (the confirmed-execution path), so the permission/kill-switch/timeout/
 * audit discipline can never drift between the two entry points. See
 * docs/ai/CAS-AI-PHASE-5.md §Action dispatch.
 */
const ACTION_EXECUTION_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface ActionDispatchOutcome {
  /** JSON-stringified and sent back to the model as the tool_result content
   *  — inert data the model reads, never re-interpreted as an instruction. */
  toolResultPayload: Record<string, unknown>;
  isError: boolean;
  /** Set only when this call created a NEW pending confirmation — the
   *  runtime attaches this to the turn's RunChatResult so the frontend can
   *  render a confirmation card without depending on the model's prose. */
  pendingAction?: PendingActionSummary;
  activityLabel: string;
}

function auditHelper(caller: CallerContext, toolName: string, category: ActionCategory, riskLevel: ActionRiskLevel, requiredPermission: string, conversationId: string, correlationId: string, startedAt: number) {
  return (status: AiActionAuditStatus, extra: { errorMessage?: string; argsFingerprint?: string; affectedResource?: Record<string, unknown> } = {}) => {
    void recordAiAction({
      caller,
      toolName,
      category,
      riskLevel,
      requiredPermission,
      confirmationStatus: 'not_required',
      status,
      durationMs: Date.now() - startedAt,
      conversationId,
      correlationId,
      ...extra,
    });
  };
}

/**
 * The propose/immediate-execute path — called once per tool_use block the
 * model produces whose name resolves in the ACTION registry (never the READ
 * registry; runtime.ts checks that first). For a tool with
 * requiresConfirmation=true, this NEVER calls tool.handler — it only builds
 * a preview and parks a pending row; execution happens exclusively via
 * executeConfirmedAction below, driven by a real confirm HTTP call.
 */
export async function executeActionToolCall(
  caller: CallerContext,
  db: SupabaseClient,
  toolName: string,
  rawArgs: unknown,
  conversationId: string
): Promise<ActionDispatchOutcome> {
  const startedAt = Date.now();
  const correlationId = newCorrelationId();
  const tool = getActionTool(toolName);

  if (!tool) {
    return { toolResultPayload: { success: false, error: `Unknown action "${toolName}".` }, isError: true, activityLabel: 'Attempting an action' };
  }

  const audit = auditHelper(caller, tool.name, tool.category, tool.riskLevel, tool.requiredPermission, conversationId, correlationId, startedAt);

  if (!callerHasPermission(caller, tool.requiredPermission)) {
    log('warn', '[AI actions] model requested an unauthorized action', { tool: tool.name, userId: caller.userId });
    audit('authorization_failed', { errorMessage: 'Forbidden' });
    return { toolResultPayload: { success: false, error: 'Forbidden: missing required permission for this action.' }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
  }

  const availability = await isActionToolAvailable(db, tool.name);
  if (!availability.enabled) {
    audit('authorization_failed', { errorMessage: availability.reason });
    return { toolResultPayload: { success: false, error: availability.reason }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
  }

  const validated = tool.validateArgs(rawArgs);
  if (validated.ok === false) {
    audit('validation_failed', { errorMessage: validated.error });
    return { toolResultPayload: { success: false, error: validated.error }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
  }

  const ctx: ActionToolExecutionContext = { caller, db };
  let preview;
  try {
    preview = await withTimeout(tool.buildPreview(ctx, validated.args), ACTION_EXECUTION_TIMEOUT_MS, 'Timed out preparing the action.');
  } catch (err: any) {
    log('error', '[AI actions] buildPreview threw or timed out', { tool: tool.name, error: err?.message });
    audit('execution_failed', { errorMessage: 'Failed to prepare the action.' });
    return { toolResultPayload: { success: false, error: 'Could not prepare this action right now.' }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
  }
  if (preview.ok === false) {
    audit('validation_failed', { errorMessage: preview.error });
    return { toolResultPayload: { success: false, error: preview.error }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
  }

  if (tool.requiresConfirmation) {
    const pendingRow = await createPendingAction(db, {
      userId: caller.userId,
      conversationId,
      toolName: tool.name,
      riskLevel: tool.riskLevel,
      category: tool.category,
      requiredPermission: tool.requiredPermission,
      args: validated.args as Record<string, unknown>,
      preview,
    });
    if (!pendingRow) {
      audit('execution_failed', { errorMessage: 'Failed to create pending confirmation.', argsFingerprint: fingerprintArgs(validated.args) });
      return { toolResultPayload: { success: false, error: 'Could not prepare this action for confirmation.' }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
    }
    return {
      toolResultPayload: { success: true, data: { status: 'confirmation_required', confirmationId: pendingRow.id, summary: preview.summary } },
      isError: false,
      pendingAction: { confirmationId: pendingRow.id, toolName: tool.name, riskLevel: tool.riskLevel, category: tool.category, preview, expiresAt: pendingRow.expires_at },
      activityLabel: actionToolActivityLabel(tool.name),
    };
  }

  // Low-risk, no confirmation required — execute immediately.
  let execResult;
  try {
    execResult = await withTimeout(tool.handler(ctx, validated.args), ACTION_EXECUTION_TIMEOUT_MS, 'Action execution timed out.');
  } catch (err: any) {
    log('error', '[AI actions] handler threw or timed out', { tool: tool.name, error: err?.message });
    audit('timeout', { errorMessage: 'Execution timed out.' });
    return { toolResultPayload: { success: false, error: 'The action took too long. Please try again.' }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
  }
  if (execResult.status !== 'executed') {
    audit(execResult.status, { errorMessage: execResult.error });
    return { toolResultPayload: { success: false, error: execResult.error }, isError: true, activityLabel: actionToolActivityLabel(tool.name) };
  }
  audit('executed', { affectedResource: execResult.affectedResource, argsFingerprint: fingerprintArgs(validated.args) });
  return { toolResultPayload: { success: true, data: execResult.data }, isError: false, activityLabel: actionToolActivityLabel(tool.name) };
}

export type ConfirmedExecutionOutcome =
  | { ok: true; data: unknown; affectedResource?: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * The confirmed-execution path — the ONLY place a requiresConfirmation=true
 * action tool's handler is ever invoked. Called exclusively from
 * actionsRouter.ts's POST /:id/confirm, itself only reachable after
 * confirmations.ts's claimPendingActionForExecution has atomically flipped
 * the row to 'processing' — i.e. after ownership, one-time-use, and
 * expiration have already been verified. This function re-checks
 * permission and the kill switch fresh (both may have changed since the
 * action was proposed) and re-validates the STORED args (defense in depth;
 * they are immutable from proposal time, so this should always still pass).
 */
export async function executeConfirmedAction(caller: CallerContext, db: SupabaseClient, pendingRow: PendingActionRow): Promise<ConfirmedExecutionOutcome> {
  const startedAt = Date.now();
  const correlationId = newCorrelationId();
  const tool = getActionTool(pendingRow.tool_name);
  const auditConfirmed = (status: AiActionAuditStatus, extra: { errorMessage?: string; argsFingerprint?: string; affectedResource?: Record<string, unknown> } = {}) =>
    void recordAiAction({
      caller,
      toolName: pendingRow.tool_name,
      category: pendingRow.category,
      riskLevel: pendingRow.risk_level,
      requiredPermission: pendingRow.required_permission,
      confirmationStatus: 'confirmed',
      status,
      durationMs: Date.now() - startedAt,
      conversationId: pendingRow.conversation_id ?? undefined,
      pendingActionId: pendingRow.id,
      correlationId,
      ...extra,
    });

  if (!tool) {
    auditConfirmed('execution_failed', { errorMessage: 'Action tool no longer registered.' });
    return { ok: false, error: 'This action is no longer available.' };
  }

  if (!callerHasPermission(caller, tool.requiredPermission)) {
    auditConfirmed('authorization_failed', { errorMessage: 'Forbidden at confirmation time.' });
    return { ok: false, error: 'Forbidden: you no longer have permission for this action.' };
  }

  const availability = await isActionToolAvailable(db, tool.name);
  if (!availability.enabled) {
    auditConfirmed('authorization_failed', { errorMessage: availability.reason });
    return { ok: false, error: availability.reason ?? 'This action is temporarily unavailable.' };
  }

  const validated = tool.validateArgs(pendingRow.args);
  if (validated.ok === false) {
    auditConfirmed('validation_failed', { errorMessage: validated.error });
    return { ok: false, error: validated.error };
  }

  const ctx: ActionToolExecutionContext = { caller, db };
  let execResult;
  try {
    execResult = await withTimeout(tool.handler(ctx, validated.args), ACTION_EXECUTION_TIMEOUT_MS, 'Action execution timed out.');
  } catch (err: any) {
    log('error', '[AI actions] confirmed handler threw or timed out', { tool: tool.name, error: err?.message });
    auditConfirmed('timeout', { errorMessage: 'Execution timed out.' });
    return { ok: false, error: 'The action took too long to complete.' };
  }
  if (execResult.status !== 'executed') {
    auditConfirmed(execResult.status, { errorMessage: execResult.error });
    return { ok: false, error: execResult.error };
  }
  auditConfirmed('executed', { affectedResource: execResult.affectedResource, argsFingerprint: pendingRow.args_fingerprint });
  return { ok: true, data: execResult.data, affectedResource: execResult.affectedResource };
}
