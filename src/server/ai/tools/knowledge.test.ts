import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ searchKnowledge: vi.fn() }));

vi.mock('../rag/retrieval', async () => {
  const actual = await vi.importActual<typeof import('../rag/retrieval')>('../rag/retrieval');
  return { ...actual, searchKnowledge: mocks.searchKnowledge };
});

import { searchKnowledgeTool } from './knowledge';
import { MAX_RESULT_LIMIT, DEFAULT_RESULT_LIMIT } from '../rag/retrieval';

beforeEach(() => {
  mocks.searchKnowledge.mockReset();
});

describe('search_knowledge tool — argument validation', () => {
  it('is registered with the expected static permission — read-only, knowledge-scoped', () => {
    expect(searchKnowledgeTool.requiredPermission).toBe('knowledge.view');
  });

  it('rejects a missing/empty query before any retrieval call', () => {
    const missing = searchKnowledgeTool.validateArgs({});
    expect(missing.ok).toBe(false);
    const empty = searchKnowledgeTool.validateArgs({ query: '   ' });
    expect(empty.ok).toBe(false);
  });

  it('rejects a non-string query', () => {
    expect(searchKnowledgeTool.validateArgs({ query: 123 }).ok).toBe(false);
  });

  it('rejects an overlong query — bounds what reaches the embedding provider/DB', () => {
    const result = searchKnowledgeTool.validateArgs({ query: 'x'.repeat(600) });
    expect(result.ok).toBe(false);
  });

  it('defaults and clamps the limit rather than trusting caller input', () => {
    const noLimit = searchKnowledgeTool.validateArgs({ query: 'how does invoicing work' });
    expect(noLimit.ok).toBe(true);
    if (noLimit.ok) expect(noLimit.args.limit).toBe(DEFAULT_RESULT_LIMIT);

    const hugeLimit = searchKnowledgeTool.validateArgs({ query: 'x', limit: 9999 });
    expect(hugeLimit.ok).toBe(true);
    if (hugeLimit.ok) expect(hugeLimit.args.limit).toBe(MAX_RESULT_LIMIT);
  });

  it('trims the query', () => {
    const result = searchKnowledgeTool.validateArgs({ query: '  invoice workflow  ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.args.query).toBe('invoice workflow');
  });
});

describe('search_knowledge tool — handler', () => {
  it('maps retrieval results into the tool result shape, preserving provenance', async () => {
    mocks.searchKnowledge.mockResolvedValue({
      success: true,
      results: [
        { chunkId: 'c1', sourceId: 's1', sourceTitle: 'CAS Accounting Workflow', chunkIndex: 0, content: 'text', similarity: 0.8, matchType: 'semantic' },
      ],
    });
    const result = await searchKnowledgeTool.handler({ caller: {} as any, db: {} as any }, { query: 'q', limit: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        { sourceTitle: 'CAS Accounting Workflow', sourceId: 's1', chunkIndex: 0, content: 'text', matchType: 'semantic', similarity: 0.8 },
      ]);
    }
  });

  it('returns an honest empty-with-note result rather than fabricating an answer when nothing matches', async () => {
    mocks.searchKnowledge.mockResolvedValue({ success: true, results: [] });
    const result = await searchKnowledgeTool.handler({ caller: {} as any, db: {} as any }, { query: 'q', limit: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
      expect(result.metadata?.note).toMatch(/no matching knowledge/i);
    }
  });

  it('propagates a retrieval failure as a tool error rather than throwing', async () => {
    mocks.searchKnowledge.mockResolvedValue({ success: false, error: 'Failed to search the knowledge base.' });
    const result = await searchKnowledgeTool.handler({ caller: {} as any, db: {} as any }, { query: 'q', limit: 5 });
    expect(result).toEqual({ success: false, error: 'Failed to search the knowledge base.' });
  });

  it('passes the validated query and limit straight through to searchKnowledge', async () => {
    mocks.searchKnowledge.mockResolvedValue({ success: true, results: [] });
    const db = {} as any;
    await searchKnowledgeTool.handler({ caller: {} as any, db }, { query: 'exact query text', limit: 3 });
    expect(mocks.searchKnowledge).toHaveBeenCalledWith(db, 'exact query text', { limit: 3 });
  });
});
