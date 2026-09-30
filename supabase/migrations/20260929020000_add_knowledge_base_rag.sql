-- ==============================================================================
-- KNOWLEDGE BASE / RAG (Phase 3 — see docs/ai/CAS-AI-PHASE-3.md)
--
-- Separate from every structured business table (projects, invoices, etc.):
-- those continue to be read exclusively through the Phase 1 tool registry.
-- This is approved textual knowledge (documentation, policies, workflow
-- explanations) — semantic search over it is a distinct capability with its
-- own permission codes and its own RLS-enforced visibility model.
--
-- RLS, not application code, is the actual authorization boundary here,
-- matching every other table in this schema: every query in
-- src/server/ai/rag/** and the search_knowledge tool runs through the
-- CALLER-SCOPED client (never service_role), so a caller without
-- knowledge.view simply gets no rows back, regardless of any bug in the
-- application layer above it.
-- ==============================================================================

create extension if not exists vector;

-- ------------------------------------------------------------------------------
-- knowledge_sources — one row per approved document (draft -> published -> archived)
-- ------------------------------------------------------------------------------
create table if not exists knowledge_sources (
  id uuid primary key default uuid_generate_v4(),
  title varchar(300) not null,
  description text,
  source_type varchar(30) not null default 'markdown'
    check (source_type in ('markdown', 'text', 'html')),
  -- Normalized plain/markdown text (HTML already stripped at ingestion time —
  -- see src/server/ai/rag/ingestion.ts). Never raw uploaded bytes; PDF/DOCX
  -- extraction, when added, still lands here as normalized text so retrieval
  -- and chunking never need to know the original file format.
  content text not null,
  -- 'internal': visible to any caller with knowledge.view once published.
  -- 'restricted': visible only to callers with knowledge.manage (content
  -- administrators) — deliberately reuses that one extra permission code
  -- rather than inventing a third, per-visibility-tier permission.
  visibility varchar(20) not null default 'internal'
    check (visibility in ('internal', 'restricted')),
  status varchar(20) not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  -- Bumped on every content edit. knowledge_chunks are tagged with the
  -- source_version they were generated from — retrieval only ever joins
  -- chunks whose source_version matches the source's CURRENT version, so a
  -- stale vector from a prior edit can never be served even if its row
  -- hasn't been cleaned up yet.
  version integer not null default 1,
  indexing_status varchar(20) not null default 'pending'
    check (indexing_status in ('pending', 'indexing', 'indexed', 'failed')),
  indexing_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  indexed_at timestamptz
);

create index if not exists idx_knowledge_sources_status on knowledge_sources(status);
create index if not exists idx_knowledge_sources_indexing_status on knowledge_sources(indexing_status);

-- ------------------------------------------------------------------------------
-- knowledge_chunks — deterministic chunks of a source's content, one embedding each
-- ------------------------------------------------------------------------------
-- Dimension is pinned to the configured embedding model (default: Voyage AI
-- voyage-3, 1024 dims — see src/server/ai/rag/embeddings/). Changing models
-- to a different dimensionality requires a new migration to widen this
-- column and a full re-index; see docs/ai/CAS-AI-PHASE-3.md §Re-indexing.
create table if not exists knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references knowledge_sources(id) on delete cascade,
  source_version integer not null,
  chunk_index integer not null,
  content text not null,
  token_estimate integer not null default 0,
  embedding vector(1024) not null,
  embedding_model varchar(100) not null,
  created_at timestamptz not null default now(),
  unique (source_id, source_version, chunk_index)
);

create index if not exists idx_knowledge_chunks_source on knowledge_chunks(source_id, source_version);
-- IVFFlat requires rows to exist to train on; safe to create empty (Postgres
-- just leaves it untrained until ANALYZE / rows accumulate — no error).
create index if not exists idx_knowledge_chunks_embedding
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- Keyword/hybrid search side of retrieval (see match_knowledge_chunks below
-- and src/server/ai/rag/retrieval.ts, which also runs a plain textSearch
-- pass merged with the vector results).
create index if not exists idx_knowledge_chunks_content_fts
  on knowledge_chunks using gin (to_tsvector('english', content));

alter table knowledge_sources enable row level security;
alter table knowledge_chunks enable row level security;

create policy "knowledge_sources_select" on knowledge_sources for select using (
  has_permission('knowledge.manage')
  or (status = 'published' and visibility = 'internal' and has_permission('knowledge.view'))
);
create policy "knowledge_sources_insert" on knowledge_sources for insert
  with check (has_permission('knowledge.manage') and is_active_user());
create policy "knowledge_sources_update" on knowledge_sources for update
  using (has_permission('knowledge.manage')) with check (has_permission('knowledge.manage'));
-- No delete policy: archive (status='archived'), don't destroy — matches
-- the rest of this schema's pattern of reversal/cancellation over deletion.

create policy "knowledge_chunks_select" on knowledge_chunks for select using (
  exists (
    select 1 from knowledge_sources s
    where s.id = source_id
      and (
        has_permission('knowledge.manage')
        or (s.status = 'published' and s.visibility = 'internal' and has_permission('knowledge.view'))
      )
  )
);
create policy "knowledge_chunks_insert" on knowledge_chunks for insert
  with check (has_permission('knowledge.manage'));
create policy "knowledge_chunks_delete" on knowledge_chunks for delete
  using (has_permission('knowledge.manage'));

-- ------------------------------------------------------------------------------
-- match_knowledge_chunks — the ONLY vector-similarity entry point.
--
-- Deliberately security INVOKER (the default — stated explicitly here), not
-- security definer: it runs as the CALLING caller-scoped role, so the
-- select policies above apply to its internal query exactly as they would
-- to a direct SELECT. No separate authorization logic is duplicated here —
-- RLS is the single source of truth for what a caller can retrieve. The
-- LLM never calls this function directly; only
-- src/server/ai/tools/knowledge.ts does, through the caller-scoped client.
-- ------------------------------------------------------------------------------
create or replace function match_knowledge_chunks(
  p_query_embedding vector(1024),
  p_match_count int default 8
)
returns table (
  chunk_id uuid,
  source_id uuid,
  chunk_index int,
  content text,
  similarity float8,
  source_title varchar,
  source_version int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id as chunk_id,
    c.source_id,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> p_query_embedding))::float8 as similarity,
    s.title as source_title,
    s.version as source_version
  from knowledge_chunks c
  join knowledge_sources s on s.id = c.source_id and s.version = c.source_version
  order by c.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 50);
$$;

-- ------------------------------------------------------------------------------
-- Permission codes (see src/services/permissionsData.ts for the matching
-- admin-UI catalog entries). Granted to existing roles here so the AI
-- Agent's knowledge tool and the admin endpoints work immediately for the
-- roles that should reasonably have them, without a manual RolesView edit.
-- ------------------------------------------------------------------------------
update roles set permissions = array_append(permissions, 'knowledge.view')
where not ('knowledge.view' = any(permissions));

update roles set permissions = array_append(permissions, 'knowledge.manage')
where code in ('super_admin', 'accounts_manager')
  and not ('knowledge.manage' = any(permissions));
