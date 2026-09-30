# CAS AI Agent — Security Runbook (Production Operations)

Concise operational reference for running the CAS AI Agent (Phases 1-5) in production. For architecture/design rationale, see `docs/ai/CAS-AI-PHASE-1.md` through `CAS-AI-PHASE-5.md`.

## Before first production deploy

1. **Apply migrations in order** — every file under `supabase/migrations/`, most recently `20260930000000_add_ai_actions.sql`. Verify `ai_pending_actions`, `ai_actions`, `ai_automations`, `ai_automation_runs`, `ai_runtime_settings` exist and RLS is enabled on all five.
2. **Set server-only secrets** (never `VITE_`-prefixed — see `.env.example`): `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `OPENAI_API_KEY` (voice), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
3. **Confirm `CRON_SECRET` is set in Vercel's project environment variables** (not just `.env` locally) — Vercel auto-attaches it as a Bearer header to cron-triggered requests once set. Without it, `/api/ai/automations/run-due` refuses every call (503).
4. **Verify the `crons` entry in `vercel.json`** is compatible with your Vercel plan's minimum frequency.
5. **Grant `ai_actions.use` / `ai_actions.manage` deliberately** — neither is granted to any role by default (this was an intentional decision; see Phase 5 doc). Use the Role Editor to opt specific roles in. Nobody gets AI write capability just because Phase 5 shipped.
6. **Confirm the AI Agent Administration nav item appears** for whichever account(s) should hold `ai_actions.manage`, and that the emergency kill switch (`actions_enabled` / `automations_enabled`) is visible and toggleable there.

## The kill switch — when and how to use it

**Symptom → action:**

| You observe | Do this |
|---|---|
| An action tool is behaving unexpectedly for all users | AI Agent Administration → Kill Switch → turn off **AI actions enabled**. Read chat/RAG/voice/multimodal keep working; every action tool refuses immediately for every user. |
| One specific tool (e.g. `create_direct_expense`) is misbehaving, others are fine | `PATCH /api/ai/admin/kill-switch` with `{"disabledActionTools": ["create_direct_expense"]}` (no dedicated UI control for this yet — use the endpoint directly, e.g. via `curl` with an `ai_actions.manage` session token). |
| Automations are sending wrong/excessive notifications | Kill Switch → turn off **Automations enabled**. Individual automations stay defined but the run-due handler sends nothing for anyone until re-enabled. |
| One user has a suspicious pending action | Pending Confirmations tab → Revoke. This is per-row and doesn't require the blanket switch. |
| One user's automation is misbehaving | Automations tab (as that admin, viewing via `ai_actions.manage`) → Disable, or delete it. |

The kill switch is **fail-closed**: if `ai_runtime_settings` can't be read (DB issue, RLS misconfiguration), actions are treated as disabled automatically — you do not need to race to flip it during a database incident.

Recovery: flip the switch back in the same panel. No redeploy needed — it's a database row, checked fresh on every dispatch.

## Reading the audit trail

- **`ai_actions`** (service-role only, no client SQL access): every action attempt's outcome — `GET /api/ai/admin/actions?limit=&status=` as an `ai_actions.manage` user. Filter by `status=execution_failed` (or `authorization_failed`, `validation_failed`, `timeout`) to find problems.
- **`ai_pending_actions`**: every proposal, including ones never confirmed — `GET /api/ai/admin/pending` for the currently-pending set; query the table directly (Supabase dashboard, `ai_actions.manage` role) for full history including resolved rows.
- **`ai_automation_runs`**: per-automation execution history — `GET /api/ai/automations/:id/runs`.
- **`audit_logs`**: for `create_direct_expense`, the RPC itself writes a normal business audit row here too (module `Expenses`, action `RECORD_EXPENSE`), attributed to the real calling user — cross-reference by `correlation_id` isn't direct (different tables), but timestamp + `document_ref` correlate the two.

Never expect secrets in any of these tables — `args_fingerprint` is a one-way SHA-256, `affected_resource` is a small safe summary, `error_message` is always a sanitized string (raw provider/Postgres errors are never persisted or returned to a client).

## Incident checklist: "the AI did something wrong"

1. Find the `ai_actions` row (or `ai_pending_actions` if unconfirmed) — get the `correlation_id`, `user_id`, `tool_name`, `confirmation_status`.
2. If it was a **confirmed** action: a human clicked Confirm on a real preview card. Check `ai_pending_actions.preview` (stored verbatim) to see exactly what was shown to them before they confirmed — this is the ground truth for "did the UI accurately represent what happened."
3. If it was **not_required** (low-risk, auto-executed): check whether the tool's own risk classification is still appropriate — a `low` tool with real-world impact worse than expected should be reclassified to `medium`/`high` (code change + redeploy, not a runtime toggle) and, in the meantime, disabled via `disabledActionTools`.
4. Check `ai_actions.affected_resource` for the record touched, then inspect that record directly (e.g. the `direct_expenses`/`vendors` row) and `audit_logs` for the RPC-level trail.
5. If a REVERSAL is needed for a posted financial transaction: use the existing, human `expenses.reverse` workflow (Approvals) — the AI Agent has no reversal tool by design.
6. If the pattern suggests a prompt-injection attempt (check the conversation's `ai_messages`/tool-result content for suspicious embedded instructions): confirm the tool list offered was still permission-correct (it always is, structurally — see Phase 5 doc §Prompt-injection defense) and file it as a content-moderation/input concern, not an authorization bypass — none has ever been possible given the architecture.

## Health checks / smoke tests (post-deploy)

Run these in order after any deploy touching `src/server/ai/**` or a new migration:

1. `GET /api/health` → `{status:'ok'}`.
2. As an authenticated user with `dashboard.view`: `POST /api/ai/chat {"message":"hello"}` → a normal reply, no tool calls.
3. As a user with `knowledge.view`: ask a documentation question → `search_knowledge` fires, `sources` populated.
4. Voice: `POST /api/ai/voice/transcribe` with a short real audio clip → a transcript. `POST /api/ai/voice/synthesize` → audio bytes back.
5. Multimodal: attach a small image via `POST /api/ai/attachments`, then reference its id in a chat message → the model describes it.
6. Action, low-risk: as a user with `ai_actions.use`, ask the agent to "remind me to check X" → `create_reminder` fires immediately, a notification appears.
7. Action, high-risk: as a user with `expenses.create` + `ai_actions.use`, ask to record an expense → a confirmation card appears (never auto-executed); click Confirm → the expense posts, the account balance changes, a real `direct_expenses` row + `audit_logs` row + `ai_actions` row all exist.
8. Confirmation edge cases: try confirming the SAME action twice (second attempt → "already confirmed/rejected" error, no double-post); let a confirmation sit past 15 minutes and confirm it → expired error.
9. Kill switch: toggle `actionsEnabled` off, retry step 6 or 7 → refused with a clear message; toggle back on.
10. Automations: create a `notify` automation with `intervalHours: 1`; manually fire `GET /api/ai/automations/run-due` with the correct `CRON_SECRET` (or wait for the real cron) → a notification appears, `ai_automation_runs` shows `succeeded`, `next_run_at` advanced.
11. Confirm the production browser bundle (`dist/assets/*.js`) contains none of: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `VOYAGE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, or any literal `sk-`-prefixed string.

## What "normal" looks like vs. what to escalate

**Normal, no action needed:**
- `ai_pending_actions` rows sitting at `status='pending'` for under 15 minutes (user hasn't decided yet).
- Occasional `validation_failed`/`authorization_failed` entries in `ai_actions` — the model requesting something malformed or unauthorized is expected and correctly refused; this is the system working, not failing.
- An automation's `consecutive_failure_count` at 1-2 after a transient blip, self-clearing on the next successful run.

**Escalate:**
- Any `ai_actions` row with `confirmation_status='confirmed'` but no corresponding user-visible confirm click you can account for (check `ai_pending_actions.resolved_at` vs. any session activity).
- Repeated `authorization_failed` for the SAME user+tool pair — could indicate a role misconfiguration or a user probing for access.
- Any evidence that `errorMessage`/`error_message` in `ai_actions` or `ai_pending_actions` contains something that looks like a raw stack trace, SQL, or a secret — file a bug immediately (every code path in this phase is designed to never leak this; its presence means something regressed).
- `ai_runtime_settings` reads failing persistently (kill switch failing closed for everyone) — a database/RLS problem needing direct investigation, not something to work around by disabling RLS.
