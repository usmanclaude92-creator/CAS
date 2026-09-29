import type express from 'express';
import { createClient } from '@supabase/supabase-js';

/**
 * Caller/auth primitives shared by src/server/app.ts and everything under
 * src/server/ai/. This file deliberately imports NOTHING from either of
 * those — app.ts imports the AI gateway (./ai/router), and several ai/**
 * modules need callerHasPermission/getCallerContext/supabaseAdmin/log, so if
 * those primitives lived in app.ts itself, any ai/** module reached before
 * app.ts finished evaluating (e.g. an ai/tools/*.ts file imported directly
 * by a unit test) would receive an undefined export off a not-yet-resolved
 * circular import. Keeping this module cycle-free is what makes every
 * import of it safe regardless of which module is entered first.
 */

// ==========================================
// SUPABASE ADMIN CLIENT (service_role — server-only, never sent to the browser)
// ==========================================
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[Server] SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin user-management endpoints to function. ' +
      'These are server-only secrets — never prefix SUPABASE_SERVICE_ROLE_KEY with VITE_.'
  );
}

export const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const entry = { level, message, time: new Date().toISOString(), ...meta };
  console[level === 'info' ? 'log' : level](JSON.stringify(entry));
}

// ==========================================
// CALLER AUTHENTICATION / AUTHORIZATION HELPERS
// Every admin endpoint independently verifies the caller's Supabase JWT and
// re-checks their permission server-side — the browser's own claim of
// "I have this permission" is never trusted.
// ==========================================
export interface CallerContext {
  userId: string;
  email: string;
  profile: Record<string, any>;
  role: Record<string, any> | null;
  /** The caller's own Supabase Auth JWT, verbatim — needed to mint an
   *  RLS-scoped (never service_role) Postgres client for AI tool reads. */
  jwt: string;
}

export async function getCallerContext(req: express.Request): Promise<CallerContext | null> {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
  if (!profile || profile.status !== 'active') return null;

  const { data: role } = await supabaseAdmin.from('roles').select('*').eq('code', profile.role_code).maybeSingle();

  return { userId: userData.user.id, email: userData.user.email || profile.email, profile, role: role ?? null, jwt: token };
}

export function callerHasPermission(caller: CallerContext, permissionCode: string): boolean {
  if (caller.role?.code === 'super_admin') return true;
  return Boolean(caller.role?.permissions?.includes(permissionCode));
}
