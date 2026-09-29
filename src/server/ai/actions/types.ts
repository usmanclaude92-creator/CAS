import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallerContext } from '../../authContext';
import type { ArgValidationResult } from '../types';

export type { ArgValidationResult } from '../types';

/**
 * A separate class of tool from the Phase 1-4 READ registry (./registry.ts,
 * ToolDefinition) — see docs/ai/CAS-AI-PHASE-5.md §Action tool architecture.
 * Every field here is set by the tool's AUTHOR at registration time, never
 * derived from a request or from the model's own tool-call arguments —
 * "the model cannot classify its own risk" is enforced by this simply not
 * being a runtime input anywhere in this type.
 */
export type ActionRiskLevel = 'low' | 'medium' | 'high';
export type ActionCategory = 'create' | 'update' | 'workflow' | 'notification' | 'administrative';

export interface ActionToolExecutionContext {
  caller: CallerContext;
  db: SupabaseClient;
}

export interface ActionPreviewField {
  label: string;
  value: string;
}

export interface ActionFinancialImpact {
  amount: number;
  currency: string;
  direction: 'debit' | 'credit' | 'none';
}

export type ActionPreviewResult =
  | {
      ok: true;
      /** One-line human summary, e.g. "Create a draft direct expense of
       *  OMR 250.000 for Project Alpha". Never displayed as fact until the
       *  action actually executes — this is a PROPOSAL, not a result. */
      summary: string;
      entityType: string;
      fields: ActionPreviewField[];
      financialImpact?: ActionFinancialImpact;
      /** True only when the action cannot be walked back by any existing,
       *  genuine server-side operation. A merely-reversible-by-a-separate-
       *  authorized-action case (e.g. a posted expense that a different
       *  permission can later reverse) is false, with that caveat stated in
       *  `warnings` instead — never implies an "Undo" button exists. */
      irreversible: boolean;
      warnings?: string[];
    }
  | { ok: false; error: string };

/**
 * One entry in the ACTION tool registry (./actionRegistry.ts). Mirrors
 * ToolDefinition's shape (requiredPermission/validateArgs/handler) so the
 * runtime's existing permission-check-before-exposure discipline applies
 * identically, but adds everything the Phase 5 directive requires: risk
 * classification, confirmation requirement, and a preview builder that runs
 * BEFORE any write, using only server-authoritative data.
 */
export interface ActionToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  /** The exact CAS permission code this tool requires — wherever an
   *  equivalent human capability already exists (vendors.edit,
   *  expenses.create, ...), this MUST be that same code, never a new one,
   *  so AI and human access to the same capability stay governed by the
   *  same role grant. */
  requiredPermission: string;
  category: ActionCategory;
  riskLevel: ActionRiskLevel;
  /** Whether this write is a single, database-transactional operation
   *  (informational — drives the "transactional behavior" metadata the
   *  directive asks for, and is asserted against in actionRegistry.test.ts
   *  for tools that touch more than one table). */
  transactional: boolean;
  /** medium/high risk tools MUST set this true — enforced by a registry-
   *  level test, not left to each tool author to remember. */
  requiresConfirmation: boolean;
  validateArgs(raw: unknown): ArgValidationResult<TArgs>;
  /** Pure from the caller's point of view: reads current authoritative
   *  values (names, balances, existence) via ctx.db to build a truthful
   *  preview, but must never write. Returning `{ok:false}` here (e.g. "no
   *  such vendor") is reported back to the model as a validation failure —
   *  the model never sees this as its own capability decision. */
  buildPreview(ctx: ActionToolExecutionContext, args: TArgs): Promise<ActionPreviewResult>;
  /** The actual write. Only ever invoked after (a) a fresh permission
   *  check, and (b) for any tool with requiresConfirmation=true, a verified,
   *  unexpired, one-time confirmation resolved server-side — see
   *  src/server/ai/actions/confirmations.ts and runtime.ts's dispatch. */
  handler(ctx: ActionToolExecutionContext, args: TArgs): Promise<ActionExecutionResult<TResult>>;
}

/**
 * Distinct from the read-tool ToolResult: the model (and the confirm
 * endpoint) must be able to tell "the write happened" apart from every other
 * outcome — never infer success merely because the tool call was accepted
 * (Phase 5 directive §14).
 */
export type ActionExecutionResult<T> =
  | { status: 'executed'; data: T; affectedResource?: Record<string, unknown> }
  | { status: 'validation_failed'; error: string }
  | { status: 'authorization_failed'; error: string }
  | { status: 'execution_failed'; error: string }
  | { status: 'timeout'; error: string };

/** What the frontend needs to render a confirmation card — attached to
 *  RunChatResult (see runtime.ts) whenever a turn proposed a
 *  confirmation-required action. Deliberately built server-side from the
 *  tool's OWN buildPreview() output, never from the model's free text — see
 *  docs/ai/CAS-AI-PHASE-5.md §Confirmation protocol, "never trust
 *  model-generated confirmation." */
export interface PendingActionSummary {
  confirmationId: string;
  toolName: string;
  riskLevel: ActionRiskLevel;
  category: ActionCategory;
  preview: Extract<ActionPreviewResult, { ok: true }>;
  expiresAt: string;
}

/** Public shape offered to the model / returned by tool-discovery endpoints
 *  — never leaks the handler/validator/preview-builder implementation. */
export interface ActionToolDescriptor {
  name: string;
  description: string;
  requiredPermission: string;
  category: ActionCategory;
  riskLevel: ActionRiskLevel;
  requiresConfirmation: boolean;
}
