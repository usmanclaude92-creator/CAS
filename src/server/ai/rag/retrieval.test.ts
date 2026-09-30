import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getEmbeddingProvider: vi.fn() }));

vi.mock('./embeddings', async () => {
  const actual = await vi.importActual<typeof import('./embeddings')>('./embeddings');
  return { ...actual, getEmbeddingProvider: mocks.getEmbeddingProvider };
});

import { searchKnowledge, MIN_SIMILARITY, MAX_RESULT_LIMIT, MAX_CHUNKS_PER_SOURCE } from './retrieval';

function fakeProvider(embed?: () => Promise<number[]>) {
  return { name: 'fake', model: 'fake-1', dimensions: 4, embed: vi.fn(embed ?? (async () => [0.1, 0.2, 0.3, 0.4])), embedBatch: vi.fn() };
}

function vectorRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    chunk_id: 'c1',
    source_id: 's1',
    chunk_index: 0,
    content: 'semantic match content',
    similarity: 0.9,
    source_title: 'Doc One',
    source_version: 1,
    ...overrides,
  };
}

function makeFakeDb(opts: {
  rpc?: { data: any; error: any };
  keyword?: { data: any; error: any };
} = {}) {
  return {
    rpc: vi.fn(async () => opts.rpc ?? { data: [], error: null }),
    from: vi.fn(() => ({
      select: () => ({
        textSearch: () => ({
          limit: async () => opts.keyword ?? { data: [], error: null },
        }),
      }),
    })),
  };
}

beforeEach(() => {
  mocks.getEmbeddingProvider.mockReset();
});

describe('searchKnowledge', () => {
  it('returns semantic (vector) matches with provenance intact', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({ rpc: { data: [vectorRow()], error: null } });

    const outcome = await searchKnowledge(db as any, 'how does invoicing work');

    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.results).toEqual([
        { chunkId: 'c1', sourceId: 's1', sourceTitle: 'Doc One', chunkIndex: 0, content: 'semantic match content', similarity: 0.9, matchType: 'semantic' },
      ]);
    }
  });

  it('filters out vector matches below MIN_SIMILARITY', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({ rpc: { data: [vectorRow({ chunk_id: 'low', similarity: MIN_SIMILARITY - 0.05 })], error: null } });

    const outcome = await searchKnowledge(db as any, 'x');
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.results).toEqual([]);
  });

  it('merges keyword matches not already returned by vector search, deduping by chunk id', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({
      rpc: { data: [vectorRow({ chunk_id: 'c1' })], error: null },
      keyword: {
        data: [
          { id: 'c1', source_id: 's1', chunk_index: 0, content: 'dup', knowledge_sources: { title: 'Doc One', version: 1 } },
          { id: 'c2', source_id: 's1', chunk_index: 1, content: 'keyword-only match', knowledge_sources: { title: 'Doc One', version: 1 } },
        ],
        error: null,
      },
    });

    const outcome = await searchKnowledge(db as any, 'x');
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      const ids = outcome.results.map((r) => r.chunkId);
      expect(ids).toEqual(['c1', 'c2']); // c1 once (semantic), c2 appended (keyword)
      expect(outcome.results[1].matchType).toBe('keyword');
    }
  });

  it('caps chunks returned per source, even when more relevant chunks exist for it', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const manyFromSameSource = Array.from({ length: MAX_CHUNKS_PER_SOURCE + 5 }, (_, i) => vectorRow({ chunk_id: `c${i}`, chunk_index: i }));
    const db = makeFakeDb({ rpc: { data: manyFromSameSource, error: null } });

    const outcome = await searchKnowledge(db as any, 'x', { limit: MAX_RESULT_LIMIT });
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.results.length).toBe(MAX_CHUNKS_PER_SOURCE);
  });

  it('caps total results to the requested/allowed limit', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const manyDifferentSources = Array.from({ length: MAX_RESULT_LIMIT + 10 }, (_, i) =>
      vectorRow({ chunk_id: `c${i}`, source_id: `s${i}` })
    );
    const db = makeFakeDb({ rpc: { data: manyDifferentSources, error: null } });

    const outcome = await searchKnowledge(db as any, 'x', { limit: 4 });
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.results.length).toBe(4);
  });

  it('clamps an out-of-range limit rather than trusting caller input', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const manyDifferentSources = Array.from({ length: 100 }, (_, i) => vectorRow({ chunk_id: `c${i}`, source_id: `s${i}` }));
    const db = makeFakeDb({ rpc: { data: manyDifferentSources, error: null } });

    const outcome = await searchKnowledge(db as any, 'x', { limit: 9999 });
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.results.length).toBeLessThanOrEqual(MAX_RESULT_LIMIT);
  });

  it('returns an empty (not error) result when nothing matches', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb();
    const outcome = await searchKnowledge(db as any, 'nothing relevant');
    expect(outcome).toEqual({ success: true, results: [] });
  });

  it('degrades to keyword-only search when the embedding provider fails, rather than failing the whole request', async () => {
    mocks.getEmbeddingProvider.mockImplementation(() => {
      throw new Error('provider down');
    });
    const db = makeFakeDb({
      keyword: { data: [{ id: 'k1', source_id: 's1', chunk_index: 0, content: 'kw', knowledge_sources: { title: 'Doc', version: 1 } }], error: null },
    });

    const outcome = await searchKnowledge(db as any, 'x');
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.results.length).toBe(1);
      expect(outcome.results[0].matchType).toBe('keyword');
    }
  });

  it('fails safely when both the vector and keyword paths error', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({ rpc: { data: null, error: { message: 'db down' } }, keyword: { data: null, error: { message: 'db down' } } });

    const outcome = await searchKnowledge(db as any, 'x');
    expect(outcome).toEqual({ success: false, error: expect.any(String) });
  });

  it('still returns vector results when only the keyword path errors', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({ rpc: { data: [vectorRow()], error: null }, keyword: { data: null, error: { message: 'fts unavailable' } } });

    const outcome = await searchKnowledge(db as any, 'x');
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.results.length).toBe(1);
  });
});
