import express from 'express';
import { getCallerContext, log } from '../authContext';
import { createCallerScopedClient } from './db';
import { getOwnedPendingAction, claimPendingActionForExecution, markRejected, recordExecutionOutcome } from './actions/confirmations';
import { executeConfirmedAction } from './actions/dispatch';

/**
 * The confirmation protocol's HTTP surface (Phase 5 — see
 * docs/ai/CAS-AI-PHASE-5.md §Confirmation protocol). Deliberately NOT a new
 * authorization path: every route here only ever acts on a row the model's
 * own action-tool call already created (via runtime.ts's
 * executeActionToolCall) and only ever re-runs that SAME tool's handler
 * with the SAME server-stored, already-validated arguments — nothing here
 * accepts new arguments from the client. This is what makes "changing
 * arguments after confirmation invalidates the confirmation" structurally
 * true rather than merely policy.
 */
export const actionsRouter = express.Router();

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }
  (req as any).caller = caller;
  next();
}

const CLAIM_FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  already_resolved: 409,
  expired: 410,
};
const CLAIM_FAILURE_MESSAGE: Record<string, string> = {
  not_found: 'Action not found.',
  already_resolved: 'This action has already been confirmed, rejected, or has expired.',
  expired: 'This confirmation has expired. Please ask again.',
};

/**
 * POST /api/ai/actions/:id/confirm — the ONLY HTTP call that can ever cause
 * a medium/high-risk action tool's handler to run. Driven exclusively by a
 * user clicking a real Confirm button in the UI; nothing in chat text can
 * reach this path (Phase 5 directive §7, "no yes-string authorization").
 */
actionsRouter.post('/:id/confirm', requireAuth, async (req, res) => {
  const caller = (req as any).caller;
  const { id } = req.params;

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI actions] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const claim = await claimPendingActionForExecution(db, id, caller.userId);
  if (claim.ok === false) {
    return res.status(CLAIM_FAILURE_STATUS[claim.reason]).json({ success: false, error: CLAIM_FAILURE_MESSAGE[claim.reason] });
  }

  let outcome;
  try {
    outcome = await executeConfirmedAction(caller, db, claim.row);
  } catch (err: any) {
    log('error', '[AI actions] executeConfirmedAction threw', { tool: claim.row.tool_name, error: err?.message });
    await recordExecutionOutcome(db, id, caller.userId, false, { error: 'Internal error executing the action.' });
    return res.status(500).json({ success: false, error: 'Internal error executing the action.' });
  }

  if (outcome.ok === false) {
    await recordExecutionOutcome(db, id, caller.userId, false, { error: outcome.error });
    return res.status(200).json({ success: false, error: outcome.error });
  }

  await recordExecutionOutcome(db, id, caller.userId, true, { data: outcome.data as any, affectedResource: outcome.affectedResource ?? null });
  return res.status(200).json({ success: true, data: outcome.data, affectedResource: outcome.affectedResource });
});

/** POST /api/ai/actions/:id/reject — the user declining a proposed action.
 *  Never executes the tool; simply marks the pending row resolved so it
 *  can't later be confirmed (e.g. by a stale/duplicate button click). */
actionsRouter.post('/:id/reject', requireAuth, async (req, res) => {
  const caller = (req as any).caller;
  const { id } = req.params;

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI actions] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const result = await markRejected(db, id, caller.userId);
  if (result.ok === false) {
    return res.status(CLAIM_FAILURE_STATUS[result.reason]).json({ success: false, error: CLAIM_FAILURE_MESSAGE[result.reason] });
  }
  return res.status(200).json({ success: true });
});

/**
 * GET /api/ai/actions/:id — lets the chat UI recover a confirmation card
 * after a page reload. Never returns the stored `args` — only what the user
 * already saw (the preview) plus status metadata; the raw validated
 * arguments are server-internal and only ever read again at confirm time.
 */
actionsRouter.get('/:id', requireAuth, async (req, res) => {
  const caller = (req as any).caller;
  const { id } = req.params;

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI actions] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const row = await getOwnedPendingAction(db, id);
  if (!row) {
    return res.status(404).json({ success: false, error: 'Action not found.' });
  }

  return res.status(200).json({
    success: true,
    action: {
      confirmationId: row.id,
      toolName: row.tool_name,
      riskLevel: row.risk_level,
      category: row.category,
      preview: row.preview,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    },
  });
});
