import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallerContext } from '../authContext.js';

/**
 * Everything a tool handler needs to run — never the service_role client.
 * `db` is scoped to the caller's own JWT, so Postgres RLS (has_permission(),
 * can_access_project()) applies exactly as it does for the human UI.
 */
export interface ToolExecutionContext {
  caller: CallerContext;
  db: SupabaseClient;
}

export type ToolResult<T> =
  | { success: true; data: T; metadata?: Record<string, unknown> }
  | { success: false; error: string };

export interface ArgValidationError {
  ok: false;
  error: string;
}

export interface ArgValidationOk<TArgs> {
  ok: true;
  args: TArgs;
}

export type ArgValidationResult<TArgs> = ArgValidationOk<TArgs> | ArgValidationError;

/**
 * One entry in the read-only tool registry. `TArgs` is whatever
 * `validateArgs` narrows raw JSON input down to — never trusted before that.
 */
export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  /** The exact CAS permission code (from src/services/permissionsData.ts)
   *  this tool requires. Checked BEFORE the tool is even offered to a caller
   *  (GET /api/ai/tools) and again on every execution (POST /api/ai/chat). */
  requiredPermission: string;
  /** Parses/validates raw JSON body input. Never pass raw request bodies to
   *  a query — this is the only place untrusted args become typed args. */
  validateArgs(raw: unknown): ArgValidationResult<TArgs>;
  handler(ctx: ToolExecutionContext, args: TArgs): Promise<ToolResult<TResult>>;
}

/** Public shape returned by GET /api/ai/tools — never leaks the handler or
 *  validator implementation, only what a caller (or, later, a model) needs
 *  to decide whether/how to call the tool. */
export interface ToolDescriptor {
  name: string;
  description: string;
  requiredPermission: string;
}
