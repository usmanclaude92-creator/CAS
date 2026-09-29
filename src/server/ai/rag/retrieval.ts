import type { SupabaseClient } from '@supabase/supabase-js';
import { getEmbeddingProvider } from './embeddings';

/**
 * The ONLY way the AI Agent's knowledge tool reaches vector/keyword search.
 * Every query here runs through the caller-scoped client passed in by
 * src/server/ai/tools/knowledge.ts — RLS on knowledge_chunks/knowledge_sources
 * (see the migration) is what actually determines what's returned; this
 * module adds no separate authorization logic of its own, matching every
 * other tool in this codebase. The LLM never calls match_knowledge_chunks
 * or queries these tables directly — only this function does, server-side.
 */

export const MIN_SIMILARITY = 0.35;
export const DEFAULT_RESULT_LIMIT = 5;
export const MAX_RESULT_LIMIT = 15;
export const MAX_CHUNKS_PER_SOURCE = 3;
const OVERFETCH_MULTIPLIER = 3;

export interface KnowledgeSearchResult {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  chunkIndex: number;
  content: string;
  similarity: number | null;
  matchType: 'semantic' | 'keyword';
}

export type KnowledgeSearchOutcome =
  | { success: true; results: KnowledgeSearchResult[] }
  | { success: false; error: string };

export async function searchKnowledge(
  db: SupabaseClient,
  query: string,
  opts: { limit?: number } = {}
): Promise<KnowledgeSearchOutcome> {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? DEFAULT_RESULT_LIMIT), 1), MAX_RESULT_LIMIT);

  // Embedding failure degrades to keyword-only search rather than failing
  // the whole request — a briefly-down embedding provider shouldn't take
  // down knowledge retrieval entirely when a plain-text fallback exists.
  let queryEmbedding: number[] | null = null;
  try {
    const provider = getEmbeddingProvider();
    queryEmbedding = await provider.embed(query, { inputType: 'query' });
  } catch {
    queryEmbedding = null;
  }

  const vectorResults: KnowledgeSearchResult[] = [];
  let vectorDbError: string | null = null;
  if (queryEmbedding) {
    const { data, error } = await db.rpc('match_knowledge_chunks', {
      p_query_embedding: queryEmbedding,
      p_match_count: limit * OVERFETCH_MULTIPLIER,
    });
    if (error) {
      vectorDbError = error.message;
    } else if (Array.isArray(data)) {
      for (const row of data as any[]) {
        if (typeof row.similarity === 'number' && row.similarity < MIN_SIMILARITY) continue;
        vectorResults.push({
          chunkId: row.chunk_id,
          sourceId: row.source_id,
          sourceTitle: row.source_title,
          chunkIndex: row.chunk_index,
          content: row.content,
          similarity: row.similarity,
          matchType: 'semantic',
        });
      }
    }
  }

  const keywordResults: KnowledgeSearchResult[] = [];
  let keywordDbError: string | null = null;
  const { data: kwData, error: kwError } = await db
    .from('knowledge_chunks')
    .select('id, source_id, chunk_index, content, knowledge_sources(title, version)')
    .textSearch('content', query, { type: 'websearch', config: 'english' })
    .limit(limit * OVERFETCH_MULTIPLIER);
  if (kwError) {
    keywordDbError = kwError.message;
  } else if (Array.isArray(kwData)) {
    for (const row of kwData as any[]) {
      keywordResults.push({
        chunkId: row.id,
        sourceId: row.source_id,
        sourceTitle: row.knowledge_sources?.title ?? 'Untitled',
        chunkIndex: row.chunk_index,
        content: row.content,
        similarity: null,
        matchType: 'keyword',
      });
    }
  }

  if (vectorDbError && keywordDbError) {
    return { success: false, error: 'Failed to search the knowledge base.' };
  }

  // Deterministic merge: similarity-ranked semantic matches first, then
  // any keyword-only matches not already present.
  const seen = new Set(vectorResults.map((r) => r.chunkId));
  const merged = [...vectorResults];
  for (const r of keywordResults) {
    if (!seen.has(r.chunkId)) {
      merged.push(r);
      seen.add(r.chunkId);
    }
  }

  // Cap chunks-per-source (diversity across documents), then cap the total
  // to the requested/allowed limit — never an unbounded result set.
  const perSourceCount = new Map<string, number>();
  const bounded: KnowledgeSearchResult[] = [];
  for (const r of merged) {
    const count = perSourceCount.get(r.sourceId) ?? 0;
    if (count >= MAX_CHUNKS_PER_SOURCE) continue;
    perSourceCount.set(r.sourceId, count + 1);
    bounded.push(r);
    if (bounded.length >= limit) break;
  }

  return { success: true, results: bounded };
}
