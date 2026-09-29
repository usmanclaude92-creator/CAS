import express from 'express';
import { getCallerContext, callerHasPermission, supabaseAdmin, log, type CallerContext } from '../authContext';
import { createCallerScopedClient } from './db';
import { asRecord, requireString } from './validation';
import { areAutomationsEnabled } from './actions/killSwitch';

/**
 * Controlled automation (Phase 5 directive §17). Deliberately restricted to
 * ONE kind — a fixed, owner-authored scheduled reminder ('notify') — for
 * the reasons documented at length in
 * supabase/migrations/20260930000000_add_ai_actions.sql and
 * docs/ai/CAS-AI-PHASE-5.md's ADR: a 'read_and_notify' kind that ran an
 * arbitrary read tool unattended would need either a live user JWT (none
 * exists in a cron context) or service-role for the read (which would
 * silently bypass can_access_project()/RLS project-scoping) — both
 * unacceptable. An automation can never grant itself a new permission: it
 * has none of its own, it only ever causes one fixed, pre-authored
 * notification insert, on a schedule the OWNER set while authenticated.
 */
export const automationsRouter = express.Router();

const MIN_INTERVAL_HOURS = 1;
const MAX_INTERVAL_HOURS = 8760; // 1 year

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }
  (req as any).caller = caller;
  next();
}

function requireIntervalHours(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < MIN_INTERVAL_HOURS || raw > MAX_INTERVAL_HOURS) {
    return { ok: false, error: `"intervalHours" must be an integer between ${MIN_INTERVAL_HOURS} and ${MAX_INTERVAL_HOURS}.` };
  }
  return { ok: true, value: raw };
}

/** POST / — create a personal automation. Requires ai_actions.use at the
 *  app layer (checked here, defense in depth) AND at the DB layer
 *  (ai_automations_insert_own RLS policy checks the same permission) — the
 *  same dual-gate discipline every write in this subsystem follows. */
automationsRouter.post('/', requireAuth, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  if (!callerHasPermission(caller, 'ai_actions.use')) {
    return res.status(403).json({ success: false, error: 'Forbidden: missing required permission "ai_actions.use".' });
  }

  const body = asRecord(req.body);
  const name = requireString(body.name, 'name', 200);
  if (name.ok === false) return res.status(400).json({ success: false, error: name.error });
  const notifyTitle = requireString(body.notifyTitle, 'notifyTitle', 255);
  if (notifyTitle.ok === false) return res.status(400).json({ success: false, error: notifyTitle.error });
  const notifyMessage = requireString(body.notifyMessage, 'notifyMessage', 1000);
  if (notifyMessage.ok === false) return res.status(400).json({ success: false, error: notifyMessage.error });
  const intervalHours = requireIntervalHours(body.intervalHours);
  if (intervalHours.ok === false) return res.status(400).json({ success: false, error: intervalHours.error });

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI automations] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const { data, error } = await db
    .from('ai_automations')
    .insert({
      owner_user_id: caller.userId,
      kind: 'notify',
      name: name.value,
      notify_title: notifyTitle.value,
      notify_message: notifyMessage.value,
      interval_hours: intervalHours.value,
    })
    .select('*')
    .single();

  if (error || !data) {
    log('error', '[AI automations] create failed', { error: error?.message });
    return res.status(500).json({ success: false, error: 'Failed to create the automation.' });
  }
  return res.status(201).json({ success: true, automation: mapAutomation(data) });
});

/** GET / — lists the caller's own automations, or (for a caller with
 *  ai_actions.manage) every user's — the ai_automations_select_own RLS
 *  policy already encodes exactly this OR, so a plain select is enough. */
automationsRouter.get('/', requireAuth, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI automations] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
  const { data, error } = await db.from('ai_automations').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ success: false, error: 'Failed to load automations.' });
  return res.status(200).json({ success: true, automations: (data ?? []).map(mapAutomation) });
});

/** PATCH /:id — edit or enable/disable. Never confirms existence for
 *  "doesn't exist" vs. "not yours" — both simply return 404, since RLS
 *  (owner or ai_actions.manage) already scopes what can be matched. */
automationsRouter.patch('/:id', requireAuth, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  const body = asRecord(req.body);

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = requireString(body.name, 'name', 200);
    if (name.ok === false) return res.status(400).json({ success: false, error: name.error });
    patch.name = name.value;
  }
  if (body.notifyTitle !== undefined) {
    const notifyTitle = requireString(body.notifyTitle, 'notifyTitle', 255);
    if (notifyTitle.ok === false) return res.status(400).json({ success: false, error: notifyTitle.error });
    patch.notify_title = notifyTitle.value;
  }
  if (body.notifyMessage !== undefined) {
    const notifyMessage = requireString(body.notifyMessage, 'notifyMessage', 1000);
    if (notifyMessage.ok === false) return res.status(400).json({ success: false, error: notifyMessage.error });
    patch.notify_message = notifyMessage.value;
  }
  if (body.intervalHours !== undefined) {
    const intervalHours = requireIntervalHours(body.intervalHours);
    if (intervalHours.ok === false) return res.status(400).json({ success: false, error: intervalHours.error });
    patch.interval_hours = intervalHours.value;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') return res.status(400).json({ success: false, error: '"enabled" must be a boolean.' });
    patch.enabled = body.enabled;
    // Re-enabling resets the failure counter — otherwise a manually
    // re-enabled automation that was auto-disabled at the failure ceiling
    // would immediately trip the ceiling again on its very next run.
    if (body.enabled === true) patch.consecutive_failure_count = 0;
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update were provided.' });
  }
  patch.updated_at = new Date().toISOString();

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI automations] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const { data, error } = await db.from('ai_automations').update(patch).eq('id', req.params.id).select('*').maybeSingle();
  if (error) return res.status(500).json({ success: false, error: 'Failed to update the automation.' });
  if (!data) return res.status(404).json({ success: false, error: 'Automation not found.' });
  return res.status(200).json({ success: true, automation: mapAutomation(data) });
});

automationsRouter.delete('/:id', requireAuth, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI automations] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
  const { data, error } = await db.from('ai_automations').delete().eq('id', req.params.id).select('id').maybeSingle();
  if (error) return res.status(500).json({ success: false, error: 'Failed to delete the automation.' });
  if (!data) return res.status(404).json({ success: false, error: 'Automation not found.' });
  return res.status(200).json({ success: true });
});

automationsRouter.get('/:id/runs', requireAuth, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI automations] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
  const { data, error } = await db
    .from('ai_automation_runs')
    .select('id, started_at, finished_at, status, result_summary, error_message')
    .eq('automation_id', req.params.id)
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ success: false, error: 'Failed to load run history.' });
  return res.status(200).json({ success: true, runs: data ?? [] });
});

/**
 * GET /run-due — Vercel Cron's entry point (see vercel.json's "crons"
 * entry). NOT session-authenticated: protected by a shared secret
 * (CRON_SECRET) compared to the Authorization header, since a scheduled
 * job has no user to authenticate as. This is the ONE place in the entire
 * AI subsystem that legitimately uses supabaseAdmin (service-role) for a
 * write — see the module doc comment above and
 * docs/ai/CAS-AI-PHASE-5.md's ADR for exactly why that's safe here and
 * nowhere else.
 */
automationsRouter.get('/run-due', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log('error', '[AI automations] CRON_SECRET is not configured — refusing to run automations');
    return res.status(503).json({ success: false, error: 'Automation runner is not configured.' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, error: 'Server is not configured with Supabase admin credentials.' });
  }

  if (!(await areAutomationsEnabled())) {
    return res.status(200).json({ success: true, ran: 0, note: 'Automations are currently disabled by an administrator.' });
  }

  const { data: due, error } = await supabaseAdmin
    .from('ai_automations')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .limit(50);
  if (error) {
    log('error', '[AI automations] failed to load due automations', { error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to load due automations.' });
  }

  let ran = 0;
  for (const automation of due ?? []) {
    ran++;
    await runOneAutomation(automation);
  }
  return res.status(200).json({ success: true, ran });
});

async function runOneAutomation(automation: any): Promise<void> {
  if (!supabaseAdmin) return;
  const runStartedAt = new Date().toISOString();
  const { data: runRow } = await supabaseAdmin.from('ai_automation_runs').insert({ automation_id: automation.id, status: 'running' }).select('id').single();

  try {
    // Defense in depth: an automation's write itself needs no special
    // permission (any active user's notifications_insert RLS already
    // allows it — see the module doc comment), but a suspended/deactivated
    // owner should still never keep receiving — or triggering — scheduled
    // notifications. This is "unauthorized automation execution" security
    // testing (Phase 5 directive §25) made concrete: the automation is
    // skipped, not silently run, the instant its owner is no longer active.
    const { data: ownerProfile } = await supabaseAdmin.from('profiles').select('status').eq('id', automation.owner_user_id).maybeSingle();
    if (!ownerProfile || ownerProfile.status !== 'active') {
      throw new Error('Automation owner is no longer an active user.');
    }

    // The one narrow, documented exception — see module doc comment.
    const { error: notifyError } = await supabaseAdmin.from('notifications').insert({
      user_id: automation.owner_user_id,
      title: automation.notify_title,
      message: automation.notify_message,
      type: 'system_update',
      severity: 'info',
    });
    if (notifyError) throw new Error(notifyError.message);

    const nextRunAt = new Date(Date.now() + automation.interval_hours * 3600_000).toISOString();
    await supabaseAdmin
      .from('ai_automations')
      .update({ last_run_at: runStartedAt, next_run_at: nextRunAt, consecutive_failure_count: 0 })
      .eq('id', automation.id);
    if (runRow) {
      await supabaseAdmin
        .from('ai_automation_runs')
        .update({ status: 'succeeded', finished_at: new Date().toISOString(), result_summary: 'Reminder notification sent.' })
        .eq('id', runRow.id);
    }
  } catch (err: any) {
    log('warn', '[AI automations] run failed', { automationId: automation.id, error: err?.message });
    const consecutiveFailureCount = (automation.consecutive_failure_count ?? 0) + 1;
    // A per-automation kill switch: an automation that keeps failing
    // disables itself rather than retrying forever (Phase 5 directive §17's
    // "execution limits"/"failure handling").
    const shouldDisable = consecutiveFailureCount >= (automation.max_consecutive_failures ?? 5);
    const nextRunAt = new Date(Date.now() + automation.interval_hours * 3600_000).toISOString();
    await supabaseAdmin
      .from('ai_automations')
      .update({ last_run_at: runStartedAt, next_run_at: nextRunAt, consecutive_failure_count: consecutiveFailureCount, enabled: shouldDisable ? false : automation.enabled })
      .eq('id', automation.id);
    if (runRow) {
      await supabaseAdmin
        .from('ai_automation_runs')
        .update({ status: 'failed', finished_at: new Date().toISOString(), error_message: 'Failed to send the scheduled notification.' })
        .eq('id', runRow.id);
    }
  }
}

function mapAutomation(row: any) {
  return {
    id: row.id,
    name: row.name,
    notifyTitle: row.notify_title,
    notifyMessage: row.notify_message,
    intervalHours: row.interval_hours,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    consecutiveFailureCount: row.consecutive_failure_count,
  };
}
