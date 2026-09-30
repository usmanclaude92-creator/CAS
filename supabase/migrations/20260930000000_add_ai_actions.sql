-- ==============================================================================
-- AI CONTROLLED ACTIONS (Phase 5 — see docs/ai/CAS-AI-PHASE-5.md)
--
-- Adds the confirmation/audit/automation infrastructure for the AI Agent's
-- new ACTION tool class (writes), kept structurally separate from the
-- Phase 1-4 READ tool registry and from the business tables themselves.
-- Critical rule (unchanged from every prior phase): the AI is still an
-- untrusted reasoning layer. Nothing here grants the AI runtime any new
-- database privilege — every table below is RLS-scoped exactly like
-- ai_conversations/ai_attachments, reached only via the caller's own JWT.
-- The two narrow exceptions (documented at each policy) are the automation
-- runner, which has no live user session by construction, and the audit
-- tables, which follow ai_tool_calls' own established "no client insert
-- policy at all" pattern.
-- ==============================================================================

-- ------------------------------------------------------------------
-- ai_pending_actions — the confirmation protocol's server-side state.
-- A row here is the ONLY thing that can ever cause an action tool's
-- handler to run for a medium/high-risk action: the model can propose
-- (insert a 'pending' row via buildPreview), but only a real, authenticated
-- HTTP call to POST /api/ai/actions/:id/confirm — driven by a human clicking
-- a button, never by chat text like "yes"/"confirmed" — can ever flip it to
-- 'executed'. See src/server/ai/actions/confirmations.ts.
-- ------------------------------------------------------------------
create table if not exists ai_pending_actions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  conversation_id uuid references ai_conversations(id) on delete cascade,
  tool_name varchar(100) not null,
  risk_level varchar(10) not null check (risk_level in ('low', 'medium', 'high')),
  category varchar(30) not null,
  required_permission varchar(100) not null,
  -- The validated arguments as of proposal time — never re-accepted from the
  -- client at confirm time (see confirmations.ts). This is what makes
  -- "changing arguments after confirmation invalidates the confirmation"
  -- structurally true: there is no argument-changing code path at all.
  args jsonb not null,
  args_fingerprint text not null,
  -- Structured preview the frontend rendered before the user confirmed —
  -- stored so a page reload can recover the same confirmation UI without
  -- re-deriving it (and so the audit trail keeps a record of what the user
  -- actually saw and agreed to).
  preview jsonb not null,
  -- 'processing' is claimed-but-not-yet-resolved: the atomic claim (pending
  -- -> processing) is what prevents double-execution; the row only reaches
  -- 'executed' once the handler has actually returned success, so a crashed
  -- or timed-out request never leaves a row that falsely reads as done (see
  -- src/server/ai/actions/confirmations.ts).
  status varchar(20) not null default 'pending' check (status in ('pending', 'processing', 'executed', 'rejected', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  resolved_at timestamptz,
  -- Safe summary only (e.g. {recordId, documentRef}) — never raw provider/DB
  -- error detail, never secrets. Populated on the same request that flips
  -- status to 'executed'/'failed'.
  execution_result jsonb
);

create index if not exists idx_ai_pending_actions_user_id on ai_pending_actions(user_id, created_at desc);
create index if not exists idx_ai_pending_actions_conversation_id on ai_pending_actions(conversation_id);
create index if not exists idx_ai_pending_actions_status on ai_pending_actions(status) where status = 'pending';

alter table ai_pending_actions enable row level security;

-- ai_actions.manage additionally sees/can revoke EVERY user's pending
-- actions — the admin-oversight "revoke pending action" capability (Phase 5
-- directive §18). Revocation still goes through the same one-time
-- conditional UPDATE ... WHERE status='pending' as a normal reject (see
-- confirmations.ts) — an admin cannot re-open or re-execute an already-
-- resolved action any more than the original user could.
create policy "ai_pending_actions_select_own" on ai_pending_actions
  for select using (user_id = auth.uid() or has_permission('ai_actions.manage'));
create policy "ai_pending_actions_insert_own" on ai_pending_actions
  for insert with check (user_id = auth.uid() and is_active_user());
create policy "ai_pending_actions_update_own" on ai_pending_actions
  for update using (user_id = auth.uid() or has_permission('ai_actions.manage'))
  with check (user_id = auth.uid() or has_permission('ai_actions.manage'));

-- ------------------------------------------------------------------
-- ai_actions — independent AI action audit trail. Deliberately separate
-- from both audit_logs (human-driven UI writes) and ai_tool_calls (Phase 1-4
-- read-tool telemetry) for the same reason ai_tool_calls itself gives for
-- not reusing audit_logs: this must be the AI subsystem's OWN, tamper-proof
-- record of what it did, writable only by the server (service_role), never
-- by any client-facing policy. See src/server/ai/actions/audit.ts.
-- ------------------------------------------------------------------
create table if not exists ai_actions (
  id uuid primary key default uuid_generate_v4(),
  executed_at timestamptz not null default now(),
  user_id uuid,
  user_role varchar(50),
  conversation_id uuid,
  pending_action_id uuid references ai_pending_actions(id),
  automation_run_id uuid,
  tool_name varchar(100) not null,
  category varchar(30) not null,
  risk_level varchar(10) not null,
  required_permission varchar(100) not null,
  confirmation_status varchar(20) not null check (confirmation_status in ('not_required', 'confirmed')),
  status varchar(20) not null check (status in ('executed', 'validation_failed', 'authorization_failed', 'execution_failed', 'timeout')),
  -- A safe fingerprint (sha256) of the validated arguments, not the raw
  -- arguments themselves — enough to detect/correlate a duplicate proposal
  -- without growing this table with full financial payloads.
  args_fingerprint text,
  -- Safe, non-sensitive summary of what was affected (e.g.
  -- {table:'direct_expenses', id, documentRef}) — never a full row, never a
  -- secret, never raw provider error text.
  affected_resource jsonb,
  error_category varchar(50),
  error_message text,
  duration_ms integer,
  correlation_id uuid not null
);

create index if not exists idx_ai_actions_user_id on ai_actions(user_id, executed_at desc);
create index if not exists idx_ai_actions_conversation_id on ai_actions(conversation_id);
create index if not exists idx_ai_actions_correlation_id on ai_actions(correlation_id);
create index if not exists idx_ai_actions_status on ai_actions(status);

alter table ai_actions enable row level security;
-- No client-facing policy at all, by design (matches ai_tool_calls) — every
-- read of this table goes through a server route (requires ai_actions.manage,
-- uses the service-role client the same way GET-style admin routes already
-- do in src/server/app.ts), every write goes through
-- src/server/ai/actions/audit.ts using supabaseAdmin.

-- ------------------------------------------------------------------
-- ai_automations — controlled, narrow automation definitions. Deliberately
-- restricted to kind='notify' (a fixed, owner-authored scheduled reminder)
-- in this phase: a 'read_and_notify' kind that ran an arbitrary read tool
-- unattended would need either a live user JWT (none exists in a cron
-- context) or service-role for the read itself (which would silently bypass
-- can_access_project()/RLS project-scoping for that automation's owner) —
-- both unacceptable per the Phase 5 directive's "never give the AI runtime
-- generic privileged database access" rule. 'notify' avoids this entirely:
-- its only write is a single, pre-authored notifications insert, and that
-- table's own RLS already permits any active user to insert for any target
-- user_id — so this is not a privilege the automation engine is uniquely
-- granted, it's the same one every user already has via the ordinary UI
-- (see src/server/ai/automationsRouter.ts's run-due handler, the one place
-- that actually performs this insert, via service-role since a scheduled
-- job has no live user JWT to act through). See docs/ai/CAS-AI-PHASE-5.md's
-- ADR for the full reasoning.
-- ------------------------------------------------------------------
create table if not exists ai_automations (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references profiles(id) on delete cascade,
  name varchar(200) not null,
  kind varchar(20) not null default 'notify' check (kind = 'notify'),
  notify_title varchar(255) not null,
  notify_message text not null,
  -- Deliberately a plain repeat interval, not cron syntax — no parser
  -- dependency, trivially testable, and sufficient for "scheduled
  -- reports/reminders" per the directive's own examples. See
  -- docs/ai/CAS-AI-PHASE-5.md's ADR.
  interval_hours integer not null check (interval_hours >= 1 and interval_hours <= 8760),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  next_run_at timestamptz not null default now(),
  consecutive_failure_count integer not null default 0,
  -- An automation that fails this many times in a row auto-disables itself
  -- (see the run-due handler) rather than retrying forever — the per-
  -- automation half of the kill-switch requirement.
  max_consecutive_failures integer not null default 5 check (max_consecutive_failures >= 1)
);

create index if not exists idx_ai_automations_owner on ai_automations(owner_user_id);
create index if not exists idx_ai_automations_due on ai_automations(next_run_at) where enabled = true;

alter table ai_automations enable row level security;

create policy "ai_automations_select_own" on ai_automations
  for select using (owner_user_id = auth.uid() or has_permission('ai_actions.manage'));
create policy "ai_automations_insert_own" on ai_automations
  for insert with check (owner_user_id = auth.uid() and is_active_user() and has_permission('ai_actions.use'));
create policy "ai_automations_update_own" on ai_automations
  for update using (owner_user_id = auth.uid() or has_permission('ai_actions.manage'))
  with check (owner_user_id = auth.uid() or has_permission('ai_actions.manage'));
create policy "ai_automations_delete_own" on ai_automations
  for delete using (owner_user_id = auth.uid() or has_permission('ai_actions.manage'));

-- ------------------------------------------------------------------
-- ai_automation_runs — execution history. Service-role-only writes (the
-- run-due handler), same "no client insert policy" pattern as ai_actions.
-- ------------------------------------------------------------------
create table if not exists ai_automation_runs (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references ai_automations(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status varchar(20) not null check (status in ('running', 'succeeded', 'failed', 'skipped_disabled', 'skipped_kill_switch')),
  result_summary text,
  error_message text
);

create index if not exists idx_ai_automation_runs_automation_id on ai_automation_runs(automation_id, started_at desc);

alter table ai_automation_runs enable row level security;
create policy "ai_automation_runs_select" on ai_automation_runs
  for select using (
    has_permission('ai_actions.manage')
    or exists (select 1 from ai_automations a where a.id = automation_id and a.owner_user_id = auth.uid())
  );
-- No client insert/update/delete policy — service-role (the run-due
-- handler) only.

-- ------------------------------------------------------------------
-- ai_runtime_settings — the server-side kill switch (section 18/31 of the
-- Phase 5 directive). Singleton row (id is always `true`). Read by every
-- action-tool dispatch and by the automation runner; only a caller holding
-- ai_actions.manage may flip it. This is enforced HERE (RLS) and again in
-- application code (src/server/ai/actions/killSwitch.ts) — the same
-- defense-in-depth discipline as every permission check elsewhere in this
-- subsystem.
-- ------------------------------------------------------------------
create table if not exists ai_runtime_settings (
  id boolean primary key default true check (id),
  actions_enabled boolean not null default true,
  automations_enabled boolean not null default true,
  -- Per-tool granularity alongside the blanket switch above (Phase 5
  -- directive §18's "disable specific AI action tool") — a tool name in
  -- this array is unavailable even while actions_enabled is otherwise true.
  disabled_action_tools text[] not null default '{}',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into ai_runtime_settings (id) values (true) on conflict (id) do nothing;

alter table ai_runtime_settings enable row level security;
create policy "ai_runtime_settings_select" on ai_runtime_settings
  for select using (is_active_user());
create policy "ai_runtime_settings_update" on ai_runtime_settings
  for update using (has_permission('ai_actions.manage')) with check (has_permission('ai_actions.manage'));
