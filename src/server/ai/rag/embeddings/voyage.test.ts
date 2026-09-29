import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoyageEmbeddingProvider, getVoyageEmbeddingProvider, VOYAGE_DIMENSIONS } from './voyage';
import { EmbeddingDimensionMismatchError, EmbeddingConfigError, EmbeddingTimeoutError, EmbeddingInvalidResponseError, EmbeddingError } from './errors';

function fakeVector(seed: number): number[] {
  return Array.from({ length: VOYAGE_DIMENSIONS }, (_, i) => (i + seed) / 1000);
}

describe('VoyageEmbeddingProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('embeds a batch and returns vectors index-ordered regardless of response order', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { index: 1, embedding: fakeVector(1) },
          { index: 0, embedding: fakeVector(0) },
        ],
      }),
    }) as any;

    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    const vectors = await provider.embedBatch(['a', 'b']);
    expect(vectors.length).toBe(2);
    expect(vectors[0]).toEqual(fakeVector(0));
    expect(vectors[1]).toEqual(fakeVector(1));
  });

  it('embed() returns a single vector via embedBatch', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: fakeVector(5) }] }),
    }) as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    const vector = await provider.embed('hello');
    expect(vector).toEqual(fakeVector(5));
  });

  it('sends inputType as input_type, defaulting to "document"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: fakeVector(0) }] }),
    });
    global.fetch = fetchMock as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    await provider.embed('q', { inputType: 'query' });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.input_type).toBe('query');

    await provider.embed('doc');
    const body2 = JSON.parse((fetchMock.mock.calls[1][1] as any).body);
    expect(body2.input_type).toBe('document');
  });

  it('returns an empty array for an empty batch without calling the network', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    expect(await provider.embedBatch([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws EmbeddingDimensionMismatchError when a vector has the wrong width — never silently stores a bad vector', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: [1, 2, 3] }] }),
    }) as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    await expect(provider.embed('x')).rejects.toBeInstanceOf(EmbeddingDimensionMismatchError);
  });

  it('throws EmbeddingInvalidResponseError when the vector count does not match the input count', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: fakeVector(0) }] }),
    }) as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    await expect(provider.embedBatch(['a', 'b'])).rejects.toBeInstanceOf(EmbeddingInvalidResponseError);
  });

  it('throws EmbeddingInvalidResponseError for a malformed (non-array-data) response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: true }) }) as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    await expect(provider.embed('x')).rejects.toBeInstanceOf(EmbeddingInvalidResponseError);
  });

  it('throws EmbeddingInvalidResponseError when the response body is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    }) as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    await expect(provider.embed('x')).rejects.toBeInstanceOf(EmbeddingInvalidResponseError);
  });

  it('wraps a non-2xx HTTP response as a safe EmbeddingError without leaking the response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    await expect(provider.embed('x')).rejects.toBeInstanceOf(EmbeddingError);
  });

  it('maps an aborted request to EmbeddingTimeoutError', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }) as any;
    const provider = new VoyageEmbeddingProvider('key', 'voyage-3');
    await expect(provider.embed('x', { timeoutMs: 5 })).rejects.toBeInstanceOf(EmbeddingTimeoutError);
  });
});

describe('getVoyageEmbeddingProvider — configuration', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.VOYAGE_API_KEY;
    delete process.env.EMBEDDING_MODEL;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws EmbeddingConfigError when VOYAGE_API_KEY is not set — never a fake/hard-coded fallback', () => {
    expect(() => getVoyageEmbeddingProvider()).toThrow(EmbeddingConfigError);
  });

  it('constructs a provider once configured, using the configured model', () => {
    process.env.VOYAGE_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'voyage-3-custom';
    const provider = getVoyageEmbeddingProvider();
    expect(provider.model).toBe('voyage-3-custom');
    expect(provider.dimensions).toBe(VOYAGE_DIMENSIONS);
  });
});
