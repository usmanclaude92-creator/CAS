import express from 'express';
import { getCallerContext, callerHasPermission, log } from '../authContext.js';
import { createCallerScopedClient } from './db.js';
import { asRecord, optionalString, optionalEnum } from './validation.js';
import { indexKnowledgeSource } from './rag/ingestion.js';

/**
 * Knowledge Base administration — create/edit/publish/archive/re-index.
 * This is an authorized APPLICATION operation, not an AI action: nothing
 * here is reachable by the LLM (it has no tool that writes to
 * knowledge_sources/knowledge_chunks — search_knowledge is read-only).
 * Gated by knowledge.manage at the app level (mirroring requireAdmin's
 * shape in app.ts) AND by RLS on every table write, via the same
 * caller-scoped client every other src/server/ai/ module uses — never
 * service_role, so a bug in the app-level check still can't grant a write
 * RLS wouldn't have allowed anyway.
 */
export const knowledgeAdminRouter = express.Router();

const SOURCE_TYPES = ['markdown', 'text', 'html'] as const;
const VISIBILITIES = ['internal', 'restricted'] as const;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_CONTENT_LENGTH = 500_000;

function requireManage(req: express.Request, res: express.Response, caller: any): boolean {
  if (!callerHasPermission(caller, 'knowledge.manage')) {
    res.status(403).json({ success: false, error: 'Forbidden: missing required permission "knowledge.manage".' });
    return false;
  }
  return true;
}

knowledgeAdminRouter.use(async (req, res, next) => {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }
  if (!requireManage(req, res, caller)) return;
  try {
    (req as any).caller = caller;
    (req as any).db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[Knowledge Admin] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
  next();
});

function requireContent(raw: unknown) {
  const r = asRecord(raw);
  const title = optionalString(r.title, 'title', MAX_TITLE_LENGTH);
  if (title.ok === false) return title;
  const description = optionalString(r.description, 'description', MAX_DESCRIPTION_LENGTH);
  if (description.ok === false) return description;
  const sourceType = optionalEnum(r.sourceType, 'sourceType', SOURCE_TYPES);
  if (sourceType.ok === false) return sourceType;
  const content = optionalString(r.content, 'content', MAX_CONTENT_LENGTH);
  if (content.ok === false) return content;
  const visibility = optionalEnum(r.visibility, 'visibility', VISIBILITIES);
  if (visibility.ok === false) return visibility;
  return {
    ok: true as const,
    value: { title: title.value, description: description.value, sourceType: sourceType.value, content: content.value, visibility: visibility.value },
  };
}

// GET /api/ai/knowledge — list all sources visible to a content administrator
// (RLS's knowledge.manage clause means this sees draft/archived too, unlike
// what an ordinary knowledge.view-only caller could ever see).
knowledgeAdminRouter.get('/', async (req, res) => {
  const db = (req as any).db;
  const { data, error } = await db
    .from('knowledge_sources')
    .select('id, title, description, source_type, visibility, status, version, indexing_status, indexing_error, created_at, updated_at, indexed_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ success: false, error: 'Failed to load knowledge sources.' });
  return res.status(200).json({ success: true, data: data ?? [] });
});

// GET /api/ai/knowledge/:id — full detail including content and metadata.
knowledgeAdminRouter.get('/:id', async (req, res) => {
  const db = (req as any).db;
  const { data, error } = await db.from('knowledge_sources').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(500).json({ success: false, error: 'Failed to load knowledge source.' });
  if (!data) return res.status(404).json({ success: false, error: 'Knowledge source not found.' });
  return res.status(200).json({ success: true, data });
});

// POST /api/ai/knowledge — create a new draft source.
knowledgeAdminRouter.post('/', async (req, res) => {
  const parsed = requireContent(req.body);
  if (parsed.ok === false) return res.status(400).json({ success: false, error: parsed.error });
  const { title, content, sourceType, description, visibility } = parsed.value;
  if (!title) return res.status(400).json({ success: false, error: '"title" is required.' });
  if (!content) return res.status(400).json({ success: false, error: '"content" is required.' });

  const db = (req as any).db;
  const caller = (req as any).caller;
  const { data, error } = await db
    .from('knowledge_sources')
    .insert({
      title,
      description: description ?? null,
      source_type: sourceType ?? 'markdown',
      content,
      visibility: visibility ?? 'internal',
      status: 'draft',
      created_by: caller.userId,
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ success: false, error: 'Failed to create knowledge source.' });
  return res.status(201).json({ success: true, data });
});

// PUT /api/ai/knowledge/:id — edit. A content change bumps `version` and
// resets indexing_status to 'pending', so match_knowledge_chunks's
// version-join immediately stops serving the now-stale chunks even before
// a re-index physically replaces them.
knowledgeAdminRouter.put('/:id', async (req, res) => {
  const parsed = requireContent(req.body);
  if (parsed.ok === false) return res.status(400).json({ success: false, error: parsed.error });
  const { title, content, sourceType, description, visibility } = parsed.value;

  const db = (req as any).db;
  const { data: existing, error: fetchError } = await db.from('knowledge_sources').select('*').eq('id', req.params.id).maybeSingle();
  if (fetchError) return res.status(500).json({ success: false, error: 'Failed to load knowledge source.' });
  if (!existing) return res.status(404).json({ success: false, error: 'Knowledge source not found.' });

  const contentChanged = content !== undefined && content !== existing.content;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (sourceType !== undefined) patch.source_type = sourceType;
  if (visibility !== undefined) patch.visibility = visibility;
  if (contentChanged) {
    patch.content = content;
    patch.version = existing.version + 1;
    patch.indexing_status = 'pending';
    patch.indexing_error = null;
    patch.indexed_at = null;
  }

  const { data, error } = await db.from('knowledge_sources').update(patch).eq('id', req.params.id).select('*').single();
  if (error) return res.status(500).json({ success: false, error: 'Failed to update knowledge source.' });
  return res.status(200).json({ success: true, data });
});

async function transitionStatus(req: express.Request, res: express.Response, status: 'published' | 'archived') {
  const db = (req as any).db;
  const { data, error } = await db.from('knowledge_sources').update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
  if (error) return res.status(404).json({ success: false, error: 'Knowledge source not found.' });
  return res.status(200).json({ success: true, data });
}

// POST /api/ai/knowledge/:id/publish
knowledgeAdminRouter.post('/:id/publish', (req, res) => transitionStatus(req, res, 'published'));
// POST /api/ai/knowledge/:id/archive — never a hard delete; matches this
// schema's reversal/cancellation-over-deletion pattern used everywhere else.
knowledgeAdminRouter.post('/:id/archive', (req, res) => transitionStatus(req, res, 'archived'));

// POST /api/ai/knowledge/:id/reindex — (re)generates chunks/embeddings for
// this source's CURRENT content/version. Safe to call repeatedly.
knowledgeAdminRouter.post('/:id/reindex', async (req, res) => {
  const db = (req as any).db;
  const outcome = await indexKnowledgeSource(db, req.params.id);
  if (outcome.success === false) {
    return res.status(422).json({ success: false, error: outcome.error });
  }
  return res.status(200).json({ success: true, chunkCount: outcome.chunkCount });
});

export const KNOWLEDGE_SOURCE_TYPES = SOURCE_TYPES;
export const KNOWLEDGE_VISIBILITIES = VISIBILITIES;
