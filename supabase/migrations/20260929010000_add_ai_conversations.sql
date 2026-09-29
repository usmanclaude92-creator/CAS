-- ==============================================================================
-- AI CONVERSATIONS / MESSAGES (Phase 2 — see docs/ai/CAS-AI-PHASE-2.md)
--
-- CAS is single-tenant (Phase 0 finding: no organization_id/tenant_id
-- anywhere) — the access boundary here is per-row ownership (auth.uid() =
-- user_id), not an org/tenant model. Every query against these tables from
-- src/server/ai/conversations.ts runs through the CALLER-SCOPED client
-- (the caller's own JWT, never service_role — same pattern as every Phase 1
-- tool), so RLS enforces "a user can only ever see their own conversation"
-- even if a bug in application code forgot to filter by user_id.
-- ==============================================================================

create table if not exists ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title varchar(200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_user_id on ai_conversations(user_id, updated_at desc);

alter table ai_conversations enable row level security;

create policy "ai_conversations_select_own" on ai_conversations
  for select using (user_id = auth.uid());

create policy "ai_conversations_insert_own" on ai_conversations
  for insert with check (user_id = auth.uid() and is_active_user());

create policy "ai_conversations_update_own" on ai_conversations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists ai_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role varchar(20) not null check (role in ('user', 'assistant')),
  -- Assistant-visible text only. Tool calls/results for a turn live in
  -- ai_tool_calls (Phase 1), correlated by conversation_id — never
  -- duplicated here, keeping this table small and avoiding a second place
  -- that could drift out of sync with the authoritative tool-call audit log.
  content text not null,
  provider varchar(50),
  model varchar(100),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_conversation_id on ai_messages(conversation_id, created_at);

alter table ai_messages enable row level security;

-- Ownership is via the parent conversation, not a duplicated user_id column
-- — a message can only be read/written by the conversation's own owner.
create policy "ai_messages_select_own" on ai_messages
  for select using (
    exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

create policy "ai_messages_insert_own" on ai_messages
  for insert with check (
    is_active_user()
    and exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

-- Correlates an ai_tool_calls row with the conversation/turn it happened
-- during. Nullable and additive — Phase 1's raw {tool,arguments} dispatch
-- (no conversation involved) continues to insert null here.
alter table ai_tool_calls add column if not exists conversation_id uuid references ai_conversations(id) on delete set null;
create index if not exists idx_ai_tool_calls_conversation_id on ai_tool_calls(conversation_id);
