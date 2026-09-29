-- ==============================================================================
-- AI TOOL CALL AUDIT (Phase 1 foundation — see docs/ai/CAS-AI-PHASE-1.md)
--
-- Deliberately separate from `audit_logs`: that table's insert policy only
-- requires is_active_user() (fine for a human UI write that always
-- accompanies a real RLS-validated mutation in the same request) and its
-- columns are shaped for transactional business events (entity_type,
-- transaction_id, document_ref). This table has NO client-facing insert
-- policy at all — only the server (service_role, src/server/ai/audit.ts)
-- can write to it, which is the guarantee an AI tool-call trail needs.
-- ==============================================================================

create table if not exists ai_tool_calls (
  id uuid primary key default uuid_generate_v4(),
  called_at timestamptz not null default now(),
  user_id uuid references profiles(id),
  user_role varchar(50),
  tool_name varchar(100) not null,
  arguments_summary jsonb,
  success boolean not null,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_tool_calls_called_at on ai_tool_calls(called_at);
create index if not exists idx_ai_tool_calls_user_id on ai_tool_calls(user_id);
create index if not exists idx_ai_tool_calls_tool_name on ai_tool_calls(tool_name);

alter table ai_tool_calls enable row level security;

-- Read access reuses the existing audit.view permission (same one that
-- gates audit_logs) rather than inventing a new permission code for Phase 1.
create policy "ai_tool_calls_select" on ai_tool_calls for select using (has_permission('audit.view'));

-- No insert/update/delete policy is defined for any role. Only a
-- service_role connection (which bypasses RLS entirely, by Postgres/
-- Supabase design) can write here — see src/server/ai/audit.ts.
