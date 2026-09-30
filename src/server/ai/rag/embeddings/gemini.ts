import type { EmbedOptions, EmbeddingInputType, EmbeddingProvider } from './types.js';
import {
  EmbeddingConfigError,
  EmbeddingDimensionMismatchError,
  EmbeddingError,
  EmbeddingInvalidResponseError,
  EmbeddingTimeoutError,
} from './errors.js';

/**
 * Google's embedding models support a configurable `outputDimensionality`
 * (Matryoshka representation learning) — set to exactly match Voyage's
 * width so no schema migration or re-index is needed to switch providers;
 * see getConfiguredEmbeddingDimensions() in ./index.ts for why that width
 * is otherwise fixed by the knowledge_chunks.embedding column. Verified
 * live against the real API (both embedContent and batchEmbedContents)
 * before writing this file.
 */
export const GEMINI_EMBEDDING_DIMENSIONS = 1024;
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 20_000;

function toTaskType(inputType: EmbeddingInputType | undefined): 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' {
  return inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly model: string;
  readonly dimensions = GEMINI_EMBEDDING_DIMENSIONS;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(text: string, opts: EmbedOptions = {}): Promise<number[]> {
    const [vector] = await this.embedBatch([text], opts);
    return vector;
  }

  async embedBatch(texts: string[], opts: EmbedOptions = {}): Promise<number[][]> {
    if (texts.length === 0) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const requests = texts.map((text) => ({
      model: `models/${this.model}`,
      content: { parts: [{ text }] },
      outputDimensionality: this.dimensions,
      taskType: toTaskType(opts.inputType),
    }));

    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(this.model)}:batchEmbedContents?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
          signal: controller.signal,
        }
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new EmbeddingTimeoutError();
      throw new EmbeddingError('request_failed', 'Failed to reach the embedding provider.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new EmbeddingError('request_failed', `Embedding provider request failed (HTTP ${res.status}).`);
    }

    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new EmbeddingInvalidResponseError();
    }
    if (!Array.isArray(body?.embeddings)) {
      throw new EmbeddingInvalidResponseError();
    }

    // Unlike Voyage (which tags each result with an index and must be
    // re-sorted), Gemini's batchEmbedContents response carries no per-item
    // index — it is documented as strictly positional, 1:1 with the
    // requests array in the order submitted.
    const vectors = body.embeddings.map((e: any) => e?.values);
    if (vectors.length !== texts.length) {
      throw new EmbeddingInvalidResponseError(`Expected ${texts.length} embeddings, got ${vectors.length}.`);
    }
    for (const vector of vectors) {
      if (!Array.isArray(vector) || vector.length !== this.dimensions) {
        throw new EmbeddingDimensionMismatchError(this.dimensions, Array.isArray(vector) ? vector.length : -1);
      }
    }

    return vectors as number[][];
  }
}

let cached: { provider: GeminiEmbeddingProvider; key: string; model: string } | null = null;

/** Lazily constructed at request time, never at module-evaluation time —
 *  same discipline as every other provider in this codebase. */
export function getGeminiEmbeddingProvider(): GeminiEmbeddingProvider {
  const apiKey = process.env.GOOGLE_AI_API_KEY || '';
  const model = process.env.EMBEDDING_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL;
  if (!apiKey) {
    throw new EmbeddingConfigError('GOOGLE_AI_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model) return cached.provider;
  cached = { provider: new GeminiEmbeddingProvider(apiKey, model), key: apiKey, model };
  return cached.provider;
}
