import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEmbeddingProvider: vi.fn(),
}));

vi.mock('./embeddings', async () => {
  const actual = await vi.importActual<typeof import('./embeddings')>('./embeddings');
  return { ...actual, getEmbeddingProvider: mocks.getEmbeddingProvider };
});

import { indexKnowledgeSource, normalizeContent, MAX_CHUNKS_PER_SOURCE } from './ingestion';
import { EmbeddingError } from './embeddings';

function fakeVector(seed: number, dims = 4): number[] {
  return Array.from({ length: dims }, (_, i) => (i + seed) / 100);
}

function makeFakeDb(seed: { knowledge_sources?: any[]; knowledge_chunks?: any[] } = {}) {
  const store: Record<string, any[]> = {
    knowledge_sources: (seed.knowledge_sources ?? []).map((r) => ({ ...r })),
    knowledge_chunks: (seed.knowledge_chunks ?? []).map((r) => ({ ...r })),
  };

  function from(table: string) {
    const rows = () => (store[table] = store[table] || []);
    return {
      select() {
        let filtered = [...rows()];
        const builder: any = {
          eq(field: string, value: any) {
            filtered = filtered.filter((r) => r[field] === value);
            return builder;
          },
          maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
        };
        return builder;
      },
      update(patch: any) {
        return {
          eq: async (field: string, value: any) => {
            for (const r of rows()) {
              if (r[field] === value) Object.assign(r, patch);
            }
            return { data: null, error: null };
          },
        };
      },
      delete() {
        return {
          eq: async (field: string, value: any) => {
            store[table] = rows().filter((r) => r[field] !== value);
            return { data: null, error: null };
          },
        };
      },
      insert(newRows: any[]) {
        return (async () => {
          const withIds = newRows.map((r, i) => ({ id: `${table}-${rows().length + i}`, ...r }));
          rows().push(...withIds);
          return { data: withIds, error: null };
        })();
      },
    };
  }

  return { from, _store: store };
}

function fakeProvider(embedBatchImpl?: (texts: string[]) => Promise<number[][]>) {
  return {
    name: 'fake-embedder',
    model: 'fake-model-v1',
    dimensions: 4,
    embed: vi.fn(),
    embedBatch: vi.fn(embedBatchImpl ?? (async (texts: string[]) => texts.map((_, i) => fakeVector(i)))),
  };
}

beforeEach(() => {
  mocks.getEmbeddingProvider.mockReset();
});

describe('normalizeContent', () => {
  it('passes markdown/text through trimmed, unchanged otherwise', () => {
    expect(normalizeContent('  Hello world.  ', 'text')).toBe('Hello world.');
    expect(normalizeContent('# Title\n\nBody', 'markdown')).toBe('# Title\n\nBody');
  });

  it('strips HTML tags/entities down to plain text with paragraph breaks preserved', () => {
    const html = '<p>Hello <b>World</b></p><p>Second paragraph &amp; more</p>';
    const normalized = normalizeContent(html, 'html');
    expect(normalized).not.toMatch(/<[^>]+>/);
    expect(normalized).toContain('Hello World');
    expect(normalized).toContain('Second paragraph & more');
  });

  it('removes script/style content entirely rather than indexing it', () => {
    const html = '<p>Visible</p><script>alert("x")</script><style>.a{color:red}</style>';
    const normalized = normalizeContent(html, 'html');
    expect(normalized).not.toContain('alert');
    expect(normalized).not.toContain('color:red');
  });
});

describe('indexKnowledgeSource', () => {
  const baseSource = {
    id: 'src-1',
    title: 'Test Doc',
    content: 'Paragraph one is here.\n\nParagraph two is here.',
    source_type: 'text',
    version: 1,
    status: 'draft',
    indexing_status: 'pending',
  };

  it('returns a safe error when the source does not exist or is not accessible (RLS-shaped null)', async () => {
    const db = makeFakeDb();
    const outcome = await indexKnowledgeSource(db as any, 'missing');
    expect(outcome).toEqual({ success: false, error: expect.any(String) });
  });

  it('chunks, embeds, and stores vectors tagged with the source id/version, marking indexing_status=indexed', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({ knowledge_sources: [baseSource] });

    const outcome = await indexKnowledgeSource(db as any, 'src-1');

    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.chunkCount).toBeGreaterThan(0);

    const chunks = db._store.knowledge_chunks;
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.source_id).toBe('src-1');
      expect(chunk.source_version).toBe(1);
      expect(chunk.embedding_model).toBe('fake-embedder:fake-model-v1');
      expect(Array.isArray(chunk.embedding)).toBe(true);
    }

    const source = db._store.knowledge_sources[0];
    expect(source.indexing_status).toBe('indexed');
    expect(source.indexing_error).toBeNull();
    expect(source.indexed_at).toBeTruthy();
  });

  it('deletes any prior chunks for the source before inserting the fresh set — no uncontrolled duplicate accumulation on re-index', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({
      knowledge_sources: [baseSource],
      knowledge_chunks: [
        { id: 'old-1', source_id: 'src-1', source_version: 1, chunk_index: 0, content: 'stale chunk', embedding: fakeVector(99) },
      ],
    });

    await indexKnowledgeSource(db as any, 'src-1');

    const chunks = db._store.knowledge_chunks;
    expect(chunks.find((c: any) => c.id === 'old-1')).toBeUndefined();
    expect(chunks.every((c: any) => c.content !== 'stale chunk')).toBe(true);
  });

  it('never leaves an old chunk from a DIFFERENT source untouched by an unrelated re-index', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({
      knowledge_sources: [baseSource, { ...baseSource, id: 'src-2', title: 'Other Doc' }],
      knowledge_chunks: [{ id: 'other-1', source_id: 'src-2', source_version: 1, chunk_index: 0, content: 'other doc chunk', embedding: fakeVector(1) }],
    });

    await indexKnowledgeSource(db as any, 'src-1');

    expect(db._store.knowledge_chunks.find((c: any) => c.id === 'other-1')).toBeDefined();
  });

  it('marks indexing_status=failed (not indexed) when the embedding provider throws, and never stores partial chunks', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(
      fakeProvider(async () => {
        throw new EmbeddingError('request_failed', 'upstream exploded');
      })
    );
    const db = makeFakeDb({ knowledge_sources: [baseSource] });

    const outcome = await indexKnowledgeSource(db as any, 'src-1');

    expect(outcome.success).toBe(false);
    const source = db._store.knowledge_sources[0];
    expect(source.indexing_status).toBe('failed');
    expect(source.indexing_error).toBeTruthy();
    expect(db._store.knowledge_chunks.length).toBe(0);
  });

  it('marks indexing_status=failed when the document produces more chunks than MAX_CHUNKS_PER_SOURCE, without calling the embedding provider', async () => {
    // Each paragraph is deliberately larger than the default chunk size
    // (1200 chars) so no two paragraphs can share a chunk — guarantees the
    // chunk count scales 1:1 with paragraph count, comfortably exceeding
    // the limit rather than relying on exact packing behavior.
    const hugeContent = Array.from({ length: MAX_CHUNKS_PER_SOURCE + 50 }, (_, i) => `Paragraph ${i} `.repeat(100)).join('\n\n');
    const provider = fakeProvider();
    mocks.getEmbeddingProvider.mockReturnValue(provider);
    const db = makeFakeDb({ knowledge_sources: [{ ...baseSource, content: hugeContent }] });

    const outcome = await indexKnowledgeSource(db as any, 'src-1');

    expect(outcome.success).toBe(false);
    expect(db._store.knowledge_sources[0].indexing_status).toBe('failed');
    expect(provider.embedBatch).not.toHaveBeenCalled();
  });

  it('marks indexing_status=failed when content normalizes to nothing chunkable', async () => {
    mocks.getEmbeddingProvider.mockReturnValue(fakeProvider());
    const db = makeFakeDb({ knowledge_sources: [{ ...baseSource, content: '   ', source_type: 'text' }] });

    const outcome = await indexKnowledgeSource(db as any, 'src-1');

    expect(outcome.success).toBe(false);
    expect(db._store.knowledge_sources[0].indexing_status).toBe('failed');
  });
});
