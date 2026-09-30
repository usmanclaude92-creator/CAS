import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '../authContext.js';

const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[AI Gateway] SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY must be ' +
      'set for AI tools to run — they mint a caller-scoped (RLS-enforced) client, never service_role.'
  );
}

/**
 * The ONE function every AI tool must use to reach Postgres. It authenticates
 * as the CALLING USER (their own JWT, forwarded verbatim as the PostgREST
 * Authorization header) — never service_role. Postgres RLS (has_permission(),
 * can_access_project(), is_active_user()) therefore applies to every query
 * exactly as it does for that same user in the ordinary CAS UI. This is the
 * database-level guardrail layer described in docs/ai/CAS-AI-ARCHITECTURE.md;
 * it must hold even if an app-level permission check above it has a bug.
 *
 * Never import supabaseAdmin (service_role) from src/server/app.ts into a
 * tool handler. That client is reserved for the small set of privileged
 * admin-mutation routes it already powers, and for the AI audit-log writer
 * (src/server/ai/audit.ts), which intentionally needs to write regardless of
 * the caller's own row-level permissions.
 */
export function createCallerScopedClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
