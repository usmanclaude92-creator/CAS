import { supabaseAdmin, log, type CallerContext } from '../authContext';

/**
 * Records one AI tool call BEFORE the result is returned to whatever caller
 * requested it (see docs/ai/CAS-AI-DATA-FLOW.md for why this can't reuse the
 * existing `audit_logs` table: that table's insert policy only requires
 * `is_active_user()`, which is fine for a human-driven UI write that always
 * accompanies a real RLS-validated mutation, but not trustworthy enough to
 * be the AI's OWN record of what it did). Writes with the service_role
 * client because this table intentionally has NO client-facing insert
 * policy at all — only the server can write to it.
 *
 * Best-effort: a failed audit write must never fail the tool call itself
 * (matches the existing `/api/demo-requests/notify-admin` resilience
 * pattern in src/server/app.ts, which also treats its own side-effect as
 * non-critical to the primary response). Logged loudly so a broken audit
 * pipeline is still visible in server logs even though it doesn't block.
 */
export interface AiToolCallRecord {
  caller: CallerContext;
  toolName: string;
  /** A short, non-sensitive summary of the arguments (e.g. which IDs were
   *  requested) — never the full tool result payload. Keeps the audit table
   *  small and avoids duplicating financial row data into a second table. */
  argumentsSummary: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
}

export async function recordAiToolCall(record: AiToolCallRecord): Promise<void> {
  if (!supabaseAdmin) {
    log('warn', '[AI audit] supabaseAdmin unavailable — tool call not recorded', { tool: record.toolName });
    return;
  }
  try {
    const { error } = await supabaseAdmin.from('ai_tool_calls').insert({
      user_id: record.caller.userId,
      user_role: record.caller.role?.code ?? null,
      tool_name: record.toolName,
      arguments_summary: record.argumentsSummary,
      success: record.success,
      error_message: record.errorMessage ?? null,
      duration_ms: record.durationMs,
    });
    if (error) {
      // Table may not exist yet in this environment until the migration in
      // supabase/migrations/ has been applied — degrade to a log line rather
      // than throwing, since auditing must never block a tool response.
      log('warn', '[AI audit] write failed', { tool: record.toolName, error: error.message });
    }
  } catch (err: any) {
    log('warn', '[AI audit] write threw', { tool: record.toolName, error: err?.message });
  }
}
