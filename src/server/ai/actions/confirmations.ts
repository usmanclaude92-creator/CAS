import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionCategory, ActionPreviewResult, ActionRiskLevel } from './types.js';

/**
 * The confirmation protocol's server-side state machine — see
 * docs/ai/CAS-AI-PHASE-5.md §Confirmation protocol. Every function here
 * runs through the CALLER-scoped client (never service_role), so RLS
 * (ai_pending_actions_*_own policies) is the actual ownership boundary —
 * this module adds no separate ownership check of its own, matching every
 * other module in src/server/ai/.
 *
 * State machine: pending -> processing -> (executed | failed)
 *                pending -> rejected
 *                pending -> expired
 * The pending -> processing transition is the ONE-TIME CLAIM: it is the
 * only step that must be race-safe, and it is, because it's a single
 * conditional UPDATE (see resolvePendingAction). Splitting "claimed" from
 * "done" means a request that crashes or times out between claiming and
 * finishing the real write leaves the row at 'processing', never at a false
 * 'executed' — the server never claims success it hasn't confirmed.
 */

export const CONFIRMATION_TTL_MINUTES = 15;

export type PendingActionStatus = 'pending' | 'processing' | 'executed' | 'rejected' | 'expired' | 'failed';

export interface PendingActionRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  tool_name: string;
  risk_level: ActionRiskLevel;
  category: ActionCategory;
  required_permission: string;
  args: Record<string, unknown>;
  args_fingerprint: string;
  preview: Record<string, unknown>;
  status: PendingActionStatus;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  execution_result: Record<string, unknown> | null;
}

/** A safe, non-reversible fingerprint of validated arguments — used for
 *  audit correlation, never as the actual authorization mechanism (the row
 *  id + ownership + status are). */
export function fingerprintArgs(args: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex');
}

export async function createPendingAction(
  db: SupabaseClient,
  params: {
    userId: string;
    conversationId: string;
    toolName: string;
    riskLevel: ActionRiskLevel;
    category: ActionCategory;
    requiredPermission: string;
    args: Record<string, unknown>;
    preview: Extract<ActionPreviewResult, { ok: true }>;
  }
): Promise<PendingActionRow | null> {
  const { data, error } = await db
    .from('ai_pending_actions')
    .insert({
      user_id: params.userId,
      conversation_id: params.conversationId,
      tool_name: params.toolName,
      risk_level: params.riskLevel,
      category: params.category,
      required_permission: params.requiredPermission,
      args: params.args,
      args_fingerprint: fingerprintArgs(params.args),
      preview: params.preview,
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return data as PendingActionRow;
}

/** Returns null for "doesn't exist" AND "not owned by this caller" (RLS) —
 *  same never-confirm-existence pattern as conversations.ts's
 *  getConversation() / attachments/index.ts's getOwnedAttachment(). */
export async function getOwnedPendingAction(db: SupabaseClient, id: string): Promise<PendingActionRow | null> {
  const { data, error } = await db.from('ai_pending_actions').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as PendingActionRow;
}

export type ClaimOutcome =
  | { ok: true; row: PendingActionRow }
  | { ok: false; reason: 'not_found' | 'already_resolved' | 'expired' };

/**
 * Atomically claims a pending row for execution (pending -> processing) or
 * resolves it to a terminal status directly (pending -> rejected/expired).
 * Race safety comes entirely from the final conditional UPDATE's
 * `.eq('status','pending')` — Postgres row-level locking means a concurrent
 * duplicate call (double-click, replay, two browser tabs) can only ever have
 * ONE request actually match that WHERE clause; every other concurrent or
 * later call sees zero rows affected and reports 'already_resolved'. This is
 * the entire idempotency guarantee for action execution.
 */
async function transitionFromPending(
  db: SupabaseClient,
  id: string,
  userId: string,
  toStatus: 'processing' | 'rejected',
  extra: Record<string, unknown> = {}
): Promise<ClaimOutcome> {
  const existing = await getOwnedPendingAction(db, id);
  if (!existing) return { ok: false, reason: 'not_found' };
  if (existing.status !== 'pending') return { ok: false, reason: 'already_resolved' };
  if (new Date(existing.expires_at).getTime() < Date.now()) {
    // Best-effort label — even if this loses a race to a concurrent
    // resolver, the WHERE clause below still prevents double-processing.
    await db.from('ai_pending_actions').update({ status: 'expired', resolved_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending');
    return { ok: false, reason: 'expired' };
  }

  const { data, error } = await db
    .from('ai_pending_actions')
    .update({ status: toStatus, ...extra })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error || !data) return { ok: false, reason: 'already_resolved' };
  return { ok: true, row: data as PendingActionRow };
}

/** The one-time claim. Callers MUST follow a successful claim with exactly
 *  one call to recordExecutionOutcome (never leave a row stuck at
 *  'processing'). */
export async function claimPendingActionForExecution(db: SupabaseClient, id: string, userId: string): Promise<ClaimOutcome> {
  return transitionFromPending(db, id, userId, 'processing');
}

export async function markRejected(db: SupabaseClient, id: string, userId: string): Promise<ClaimOutcome> {
  return transitionFromPending(db, id, userId, 'rejected', { resolved_at: new Date().toISOString() });
}

/**
 * Admin oversight revoke (Phase 5 directive §18) — an ai_actions.manage
 * caller cancelling ANOTHER user's still-pending action. Filters the final
 * UPDATE by the row's OWN owner (not the calling admin's id), since RLS
 * (ai_pending_actions_update_own) is what actually authorizes this for an
 * admin — the id-based WHERE clause here exists only for the same
 * one-time-use race safety every other transition uses, never as an
 * ownership check. `db` must still be the ADMIN's caller-scoped client so
 * RLS's `has_permission('ai_actions.manage')` branch is what allows this
 * through in the first place.
 */
export async function adminRevokePendingAction(db: SupabaseClient, id: string): Promise<ClaimOutcome> {
  const existing = await getOwnedPendingAction(db, id);
  if (!existing) return { ok: false, reason: 'not_found' };
  if (existing.status !== 'pending') return { ok: false, reason: 'already_resolved' };

  const { data, error } = await db
    .from('ai_pending_actions')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', existing.user_id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error || !data) return { ok: false, reason: 'already_resolved' };
  return { ok: true, row: data as PendingActionRow };
}

/** Finalizes a claimed ('processing') row after the real tool handler has
 *  actually run — the only place status ever becomes 'executed'. */
export async function recordExecutionOutcome(
  db: SupabaseClient,
  id: string,
  userId: string,
  succeeded: boolean,
  executionResult: Record<string, unknown>
): Promise<void> {
  await db
    .from('ai_pending_actions')
    .update({ status: succeeded ? 'executed' : 'failed', resolved_at: new Date().toISOString(), execution_result: executionResult })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', 'processing');
}
