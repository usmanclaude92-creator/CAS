import express from 'express';
import { getCallerContext, callerHasPermission, supabaseAdmin, log, type CallerContext } from '../authContext';
import { createCallerScopedClient } from './db';
import { adminRevokePendingAction } from './actions/confirmations';

/**
 * Human oversight surface for the AI action subsystem (Phase 5 directive
 * §18). Every route requires ai_actions.manage — checked at the app layer
 * here AND (for the routes that write) again by RLS, the same dual-gate
 * discipline as everywhere else in src/server/ai/. `ai_actions` itself has
 * no client-facing RLS policy at all (mirrors ai_tool_calls), so reading it
 * is the one place this router legitimately uses supabaseAdmin — every
 * write here still goes through the caller's own RLS-scoped client.
 */
export const aiAdminRouter = express.Router();

async function requireManage(req: express.Request, res: express.Response, next: express.NextFunction) {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }
  if (!callerHasPermission(caller, 'ai_actions.manage')) {
    return res.status(403).json({ success: false, error: 'Forbidden: missing required permission "ai_actions.manage".' });
  }
  (req as any).caller = caller;
  next();
}

const MAX_LIMIT = 200;

/** GET /actions — recent AI action executions across every user, for
 *  spotting failures/unusual activity. Read-only, service-role (ai_actions
 *  has no client select policy by design). */
aiAdminRouter.get('/actions', requireManage, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Server is not configured with Supabase admin credentials.' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), MAX_LIMIT);
  let query = supabaseAdmin.from('ai_actions').select('*').order('executed_at', { ascending: false }).limit(limit);
  if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);
  const { data, error } = await query;
  if (error) {
    log('error', '[AI admin] failed to load recent actions', { error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to load recent actions.' });
  }
  return res.status(200).json({ success: true, actions: data ?? [] });
});

/** GET /pending — every user's currently-pending confirmations (not just
 *  the caller's own — the ai_pending_actions_select_own RLS policy's
 *  has_permission('ai_actions.manage') branch is what makes this see
 *  everyone's rows through the ordinary caller-scoped client). */
aiAdminRouter.get('/pending', requireManage, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI admin] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
  const { data, error } = await db.from('ai_pending_actions').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(MAX_LIMIT);
  if (error) return res.status(500).json({ success: false, error: 'Failed to load pending actions.' });
  return res.status(200).json({ success: true, pending: data ?? [] });
});

/** POST /pending/:id/revoke — cancel ANOTHER user's still-pending action
 *  before they confirm it. */
aiAdminRouter.post('/pending/:id/revoke', requireManage, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI admin] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
  const result = await adminRevokePendingAction(db, req.params.id);
  if (result.ok === false) {
    const status = result.reason === 'not_found' ? 404 : 409;
    const message = result.reason === 'not_found' ? 'Action not found.' : 'This action has already been confirmed, rejected, or has expired.';
    return res.status(status).json({ success: false, error: message });
  }
  return res.status(200).json({ success: true });
});

/** GET /kill-switch — current global action/automation enablement and any
 *  individually disabled action tools. */
aiAdminRouter.get('/kill-switch', requireManage, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI admin] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
  const { data, error } = await db.from('ai_runtime_settings').select('*').eq('id', true).maybeSingle();
  if (error || !data) return res.status(500).json({ success: false, error: 'Failed to load AI runtime settings.' });
  return res.status(200).json({
    success: true,
    settings: {
      actionsEnabled: data.actions_enabled,
      automationsEnabled: data.automations_enabled,
      disabledActionTools: data.disabled_action_tools ?? [],
      updatedAt: data.updated_at,
    },
  });
});

/** PATCH /kill-switch — the emergency AI-action kill switch itself, plus
 *  per-tool disable. Enforced server-side (RLS's ai_actions.manage check on
 *  UPDATE), never a client-side-only toggle. */
aiAdminRouter.patch('/kill-switch', requireManage, async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  const patch: Record<string, unknown> = {};
  if (body.actionsEnabled !== undefined) {
    if (typeof body.actionsEnabled !== 'boolean') return res.status(400).json({ success: false, error: '"actionsEnabled" must be a boolean.' });
    patch.actions_enabled = body.actionsEnabled;
  }
  if (body.automationsEnabled !== undefined) {
    if (typeof body.automationsEnabled !== 'boolean') return res.status(400).json({ success: false, error: '"automationsEnabled" must be a boolean.' });
    patch.automations_enabled = body.automationsEnabled;
  }
  if (body.disabledActionTools !== undefined) {
    if (!Array.isArray(body.disabledActionTools) || !body.disabledActionTools.every((t: unknown) => typeof t === 'string')) {
      return res.status(400).json({ success: false, error: '"disabledActionTools" must be an array of strings.' });
    }
    patch.disabled_action_tools = body.disabledActionTools;
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update were provided.' });
  }
  patch.updated_by = caller.userId;
  patch.updated_at = new Date().toISOString();

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI admin] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const { data, error } = await db.from('ai_runtime_settings').update(patch).eq('id', true).select('*').maybeSingle();
  if (error || !data) return res.status(500).json({ success: false, error: 'Failed to update AI runtime settings.' });

  log('info', '[AI admin] kill switch updated', { actor: caller.email, patch });
  return res.status(200).json({
    success: true,
    settings: {
      actionsEnabled: data.actions_enabled,
      automationsEnabled: data.automations_enabled,
      disabledActionTools: data.disabled_action_tools ?? [],
      updatedAt: data.updated_at,
    },
  });
});
