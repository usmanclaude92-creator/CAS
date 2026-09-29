import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin, log } from '../../authContext';

/**
 * The server-side-enforced emergency AI-action kill switch (Phase 5
 * directive §18/§31). Backed by the singleton `ai_runtime_settings` row —
 * see supabase/migrations/20260930000000_add_ai_actions.sql. Checked on
 * every action-tool dispatch (actions/dispatch.ts) and by the automation
 * runner before executing anything.
 *
 * Fails CLOSED: if the settings row can't be read for any reason (RLS
 * misconfiguration, transient DB error, table not yet migrated), actions
 * are treated as DISABLED, not enabled. A kill switch that could be
 * silently bypassed by a database hiccup would defeat its own purpose —
 * unlike a read tool or the chat endpoint itself, action execution is
 * exactly the place to fail safe rather than fail available.
 */

export interface ActionAvailability {
  enabled: boolean;
  /** Safe, user-facing reason — only set when enabled is false. */
  reason?: string;
}

interface RuntimeSettingsRow {
  actions_enabled: boolean;
  disabled_action_tools: string[] | null;
}

async function fetchSettings(db: SupabaseClient): Promise<RuntimeSettingsRow | null> {
  try {
    const { data, error } = await db.from('ai_runtime_settings').select('actions_enabled, disabled_action_tools').eq('id', true).maybeSingle();
    if (error || !data) return null;
    return data as RuntimeSettingsRow;
  } catch {
    return null;
  }
}

/** Combined blanket-switch + per-tool-disable check for one action tool
 *  call. This is the ONE function every action dispatch path must call
 *  before doing anything else. */
export async function isActionToolAvailable(db: SupabaseClient, toolName: string): Promise<ActionAvailability> {
  const settings = await fetchSettings(db);
  if (!settings) {
    log('warn', '[AI kill switch] could not read ai_runtime_settings — failing closed (actions disabled)', { toolName });
    return { enabled: false, reason: 'AI actions are temporarily unavailable.' };
  }
  if (!settings.actions_enabled) {
    return { enabled: false, reason: 'AI actions are temporarily disabled by an administrator.' };
  }
  if (settings.disabled_action_tools?.includes(toolName)) {
    return { enabled: false, reason: 'This specific action has been temporarily disabled by an administrator.' };
  }
  return { enabled: true };
}

/** The automation runner has no live user session (it's cron-invoked), so
 *  this reads via supabaseAdmin — the other narrow, documented exception in
 *  this module (see docs/ai/CAS-AI-PHASE-5.md's ADR on automations). Still
 *  fails closed. Automations have no per-tool granularity (they only ever
 *  do the fixed 'notify' kind), so this stays a plain boolean. */
export async function areAutomationsEnabled(): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data, error } = await supabaseAdmin.from('ai_runtime_settings').select('automations_enabled').eq('id', true).maybeSingle();
    if (error || !data) {
      log('warn', '[AI kill switch] could not read ai_runtime_settings for automations — failing closed', { error: error?.message });
      return false;
    }
    return Boolean(data.automations_enabled);
  } catch (err: any) {
    log('warn', '[AI kill switch] threw reading ai_runtime_settings for automations — failing closed', { error: err?.message });
    return false;
  }
}
