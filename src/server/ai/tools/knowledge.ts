import type { ToolDefinition, ArgValidationResult } from '../types';
import { asRecord } from '../validation';
import { searchKnowledge, DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT } from '../rag/retrieval';

const MAX_QUERY_LENGTH = 500;

interface SearchKnowledgeArgs {
  query: string;
  limit: number;
}

/**
 * The knowledge/RAG counterpart to Phase 1's structured-data tools — same
 * registry, same static-permission/validateArgs/caller-scoped-execution/
 * audit shape, so the router's dispatch loop in runtime.ts treats it
 * identically to get_vendors, get_invoices, etc. It answers "how/what/
 * explain" documentation questions, never authoritative financial figures
 * (those stay on the structured tools — see systemPrompt.ts).
 */
export const searchKnowledgeTool: ToolDefinition<SearchKnowledgeArgs, unknown[]> = {
  name: 'search_knowledge',
  description:
    'Searches CAS internal documentation and knowledge base (workflow guides, accounting concepts, module explanations, policies/procedures) for content relevant to a question. Use this for "how does X work" / "explain Y" / "what does this module do" questions — never for live financial figures, which come from the structured data tools instead.',
  requiredPermission: 'knowledge.view',
  validateArgs(raw: unknown): ArgValidationResult<SearchKnowledgeArgs> {
    const r = asRecord(raw);
    if (typeof r.query !== 'string' || r.query.trim().length === 0) {
      return { ok: false, error: '"query" is required and must be a non-empty string.' };
    }
    if (r.query.length > MAX_QUERY_LENGTH) {
      return { ok: false, error: `"query" must be at most ${MAX_QUERY_LENGTH} characters.` };
    }
    const rawLimit = Number(r.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_RESULT_LIMIT) : DEFAULT_RESULT_LIMIT;
    return { ok: true, args: { query: r.query.trim(), limit } };
  },
  async handler(ctx, args) {
    const result = await searchKnowledge(ctx.db, args.query, { limit: args.limit });
    if (result.success === false) return { success: false, error: result.error };

    if (result.results.length === 0) {
      return {
        success: true,
        data: [],
        metadata: { count: 0, note: 'No matching knowledge found for this query — say so rather than guessing.' },
      };
    }

    return {
      success: true,
      data: result.results.map((r) => ({
        sourceTitle: r.sourceTitle,
        sourceId: r.sourceId,
        chunkIndex: r.chunkIndex,
        content: r.content,
        matchType: r.matchType,
        similarity: r.similarity,
      })),
      metadata: { count: result.results.length },
    };
  },
};
