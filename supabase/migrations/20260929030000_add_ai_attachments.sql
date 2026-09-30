-- ==============================================================================
-- AI ATTACHMENTS (Phase 4 — see docs/ai/CAS-AI-PHASE-4.md)
--
-- Temporary, per-user, conversation-scoped media (images/documents) attached
-- to an AI Agent chat message. Deliberately a SEPARATE table/bucket from the
-- existing `attachments` table + `construction_attachments` bucket (business
-- vouchers/receipts tied to a transaction, permission-gated via
-- documents.*): this is ephemeral AI input context, not a permanent business
-- record, and Phase 3's own docs already establish the principle that
-- temporary uploaded content and permanent approved knowledge must stay
-- separate — the same separation applies here, one level earlier, between
-- temporary AI attachments and the PERMANENT `attachments` table.
--
-- No new permission code gates this table: voice/multimodal input are
-- additional modalities, not a new security boundary (Phase 4 directive).
-- The only boundary is per-row ownership (auth.uid() = user_id), exactly
-- like ai_conversations in Phase 2 — a caller can only ever see, use, or
-- delete their own attachments.
-- ==============================================================================

insert into storage.buckets (id, name, public)
values ('ai-attachments', 'ai-attachments', false)
on conflict (id) do nothing;

create table if not exists ai_attachments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- Set when the attachment is first referenced in a chat message (see
  -- src/server/ai/runtime.ts) and never changed after — an attachment
  -- cannot be "moved" to a different conversation once used, which is what
  -- keeps temporary context scoped to the conversation it was uploaded for.
  conversation_id uuid references ai_conversations(id) on delete cascade,
  kind varchar(20) not null check (kind in ('image', 'document')),
  mime_type varchar(100) not null,
  file_name varchar(255) not null,
  file_size bigint not null,
  storage_path text not null,
  status varchar(20) not null default 'uploaded' check (status in ('uploaded', 'used', 'expired')),
  created_at timestamptz not null default now(),
  -- Short-lived by design: an uploaded-but-never-used attachment expires in
  -- 24h; storage cleanup of expired rows/objects is an operational task
  -- (see docs/ai/CAS-AI-PHASE-4.md §Storage/cleanup) — this column is what
  -- makes an expired attachment invisible to retrieval immediately, ahead
  -- of any physical deletion job actually running.
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_ai_attachments_user_id on ai_attachments(user_id, created_at desc);
create index if not exists idx_ai_attachments_conversation_id on ai_attachments(conversation_id);
create index if not exists idx_ai_attachments_expires_at on ai_attachments(expires_at);

alter table ai_attachments enable row level security;

create policy "ai_attachments_select_own" on ai_attachments
  for select using (user_id = auth.uid());

create policy "ai_attachments_insert_own" on ai_attachments
  for insert with check (user_id = auth.uid() and is_active_user());

create policy "ai_attachments_update_own" on ai_attachments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ai_attachments_delete_own" on ai_attachments
  for delete using (user_id = auth.uid());

-- Storage object policies — standard Supabase per-user-folder pattern.
-- Every object is stored at `{auth.uid()}/{attachmentId}/{fileName}`
-- (enforced by src/server/ai/attachments.ts, not by SQL, since Storage RLS
-- can only check the path, not who constructed it — the table row above,
-- inserted via the same caller-scoped client, is the actual record of
-- ownership/expiry that src/server/ai/rag and runtime.ts rely on).
create policy "ai_attachments_storage_insert" on storage.objects
  for insert with check (bucket_id = 'ai-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ai_attachments_storage_select" on storage.objects
  for select using (bucket_id = 'ai-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ai_attachments_storage_delete" on storage.objects
  for delete using (bucket_id = 'ai-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Correlates an ai_tool_calls row with any attachment(s) used during that
-- call, for audit purposes — nullable and additive, mirrors the Phase 3
-- conversation_id column added to this same table.
alter table ai_tool_calls add column if not exists attachment_count integer not null default 0;
