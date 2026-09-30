import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkText } from './chunking.js';
import { getEmbeddingProvider, EmbeddingError } from './embeddings/index.js';
import type { EmbeddingProvider } from './embeddings/index.js';

/**
 * Server-side ingestion/indexing pipeline. The browser never indexes
 * anything — src/server/ai/knowledgeAdminRouter.ts is the only caller of
 * indexKnowledgeSource(), itself only reachable by a caller holding
 * knowledge.manage, and every DB write here goes through the SAME
 * caller-scoped client as everywhere else in src/server/ai/ (RLS applies;
 * no service_role anywhere in this subsystem).
 *
 * Lifecycle implemented here: normalize -> chunk -> embed -> store,
 * invalidating the previous index first (delete-before-insert, so a
 * request that fails partway never leaves a mix of old and new chunks) and
 * marking indexing_status accurately at every stage so a document never
 * appears indexed when indexing actually failed.
 */

export const MAX_CHUNKS_PER_SOURCE = 500;
const EMBED_BATCH_SIZE = 32;

export type SourceType = 'markdown' | 'text' | 'html';

export type IndexOutcome = { success: true; chunkCount: number } | { success: false; error: string };

/**
 * Strips a source down to normalized plain/markdown text before chunking.
 * Deliberately simple (regex-based, no HTML parser dependency) — this
 * ingests approved, admin-authored documentation, not untrusted scraped
 * web content, so a best-effort tag strip is sufficient. Designed so a
 * future PDF/DOCX source type only needs a new branch here (extraction ->
 * normalized text) — chunking/embedding/retrieval never change.
 */
export function normalizeContent(raw: string, sourceType: SourceType): string {
  if (sourceType !== 'html') return raw.trim();
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function embedInBatches(provider: EmbeddingProvider, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await provider.embedBatch(batch, { inputType: 'document' });
    out.push(...vectors);
  }
  return out;
}

async function markFailed(db: SupabaseClient, sourceId: string, message: string): Promise<void> {
  await db
    .from('knowledge_sources')
    .update({ indexing_status: 'failed', indexing_error: message })
    .eq('id', sourceId);
}

/**
 * Indexes (or re-indexes) one knowledge source's CURRENT content/version.
 * Idempotent and safe to call repeatedly: existing chunks for this source
 * (any version) are deleted before the fresh set is inserted, so a
 * re-index never accumulates uncontrolled duplicates and a failed run
 * never leaves half-old, half-new chunks in place.
 */
export async function indexKnowledgeSource(db: SupabaseClient, sourceId: string): Promise<IndexOutcome> {
  const { data: source, error: fetchError } = await db
    .from('knowledge_sources')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (fetchError || !source) {
    return { success: false, error: 'Knowledge source not found or not accessible.' };
  }

  await db.from('knowledge_sources').update({ indexing_status: 'indexing', indexing_error: null }).eq('id', sourceId);

  try {
    const normalized = normalizeContent(source.content, source.source_type as SourceType);
    const chunks = chunkText(normalized);

    if (chunks.length === 0) {
      const message = 'Content produced no chunks after normalization.';
      await markFailed(db, sourceId, message);
      return { success: false, error: message };
    }
    if (chunks.length > MAX_CHUNKS_PER_SOURCE) {
      const message = `Document produced ${chunks.length} chunks, exceeding the ${MAX_CHUNKS_PER_SOURCE}-chunk limit per source.`;
      await markFailed(db, sourceId, message);
      return { success: false, error: message };
    }

    const provider = getEmbeddingProvider();
    const vectors = await embedInBatches(provider, chunks.map((c) => c.content));
    if (vectors.length !== chunks.length) {
      const message = 'Embedding provider returned an unexpected number of vectors.';
      await markFailed(db, sourceId, message);
      return { success: false, error: message };
    }

    // Invalidate the previous index (any version) before writing the new
    // one — the match_knowledge_chunks join (source_version = current
    // version) already makes a stale index invisible the moment the
    // source's version changes; this delete just keeps storage bounded and
    // covers a same-version re-index (e.g. after an embedding model change)
    // where the version number didn't move.
    await db.from('knowledge_chunks').delete().eq('source_id', sourceId);

    const rows = chunks.map((chunk, i) => ({
      source_id: sourceId,
      source_version: source.version,
      chunk_index: chunk.index,
      content: chunk.content,
      token_estimate: chunk.tokenEstimate,
      embedding: vectors[i],
      embedding_model: `${provider.name}:${provider.model}`,
    }));

    const { error: insertError } = await db.from('knowledge_chunks').insert(rows);
    if (insertError) {
      const message = 'Failed to store generated embeddings.';
      await markFailed(db, sourceId, message);
      return { success: false, error: message };
    }

    await db
      .from('knowledge_sources')
      .update({ indexing_status: 'indexed', indexing_error: null, indexed_at: new Date().toISOString() })
      .eq('id', sourceId);

    return { success: true, chunkCount: rows.length };
  } catch (err: any) {
    const message = err instanceof EmbeddingError ? 'Failed to generate embeddings for this document.' : 'Indexing failed unexpectedly.';
    await markFailed(db, sourceId, message);
    return { success: false, error: message };
  }
}
