import crypto from 'node:crypto';
import { supabaseAdmin, log, type CallerContext } from '../../authContext.js';
import type { ActionCategory, ActionRiskLevel } from './types.js';

/**
 * The AI subsystem's OWN action audit trail — independently queryable from
 * both the generic `audit_logs` table (human-driven UI writes) and Phase
 * 1-4's `ai_tool_calls` (read-tool telemetry), for the same reason
 * ai_tool_calls itself was kept separate from audit_logs: this table has NO
 * client-facing insert policy at all, only the server (service_role) can
 * write to it, so it can't be quietly incomplete or tampered with by
 * anything short of a server compromise. See
 * supabase/migrations/20260930000000_add_ai_actions.sql and
 * docs/ai/CAS-AI-PHASE-5.md §Audit model.
 *
 * Best-effort, like recordAiToolCall: a failed audit write must never fail
 * the action response itself, but is logged loudly so a broken audit
 * pipeline stays visible server-side.
 */
export type AiActionAuditStatus = 'executed' | 'validation_failed' | 'authorization_failed' | 'execution_failed' | 'timeout';

export interface AiActionRecord {
  caller: CallerContext;
  toolName: string;
  category: ActionCategory;
  riskLevel: ActionRiskLevel;
  requiredPermission: string;
  confirmationStatus: 'not_required' | 'confirmed';
  status: AiActionAuditStatus;
  argsFingerprint?: string;
  /** Safe, non-sensitive summary only (e.g. {table, id, documentRef}) —
   *  never a full row, never a secret. */
  affectedResource?: Record<string, unknown>;
  errorCategory?: string;
  errorMessage?: string;
  durationMs: number;
  conversationId?: string;
  pendingActionId?: string;
  automationRunId?: string;
  correlationId: string;
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export async function recordAiAction(record: AiActionRecord): Promise<void> {
  if (!supabaseAdmin) {
    log('warn', '[AI action audit] supabaseAdmin unavailable — action not recorded', { tool: record.toolName, correlationId: record.correlationId });
    return;
  }
  try {
    const { error } = await supabaseAdmin.from('ai_actions').insert({
      user_id: record.caller.userId,
      user_role: record.caller.role?.code ?? null,
      conversation_id: record.conversationId ?? null,
      pending_action_id: record.pendingActionId ?? null,
      automation_run_id: record.automationRunId ?? null,
      tool_name: record.toolName,
      category: record.category,
      risk_level: record.riskLevel,
      required_permission: record.requiredPermission,
      confirmation_status: record.confirmationStatus,
      status: record.status,
      args_fingerprint: record.argsFingerprint ?? null,
      affected_resource: record.affectedResource ?? null,
      error_category: record.errorCategory ?? null,
      error_message: record.errorMessage ?? null,
      duration_ms: record.durationMs,
      correlation_id: record.correlationId,
    });
    if (error) {
      // Table may not exist yet until the migration has been applied —
      // degrade to a log line rather than throwing (auditing must never
      // block an action response).
      log('warn', '[AI action audit] write failed', { tool: record.toolName, error: error.message, correlationId: record.correlationId });
    }
  } catch (err: any) {
    log('warn', '[AI action audit] write threw', { tool: record.toolName, error: err?.message, correlationId: record.correlationId });
  }
}
