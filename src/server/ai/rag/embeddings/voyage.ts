import type { EmbedOptions, EmbeddingProvider } from './types';
import {
  EmbeddingConfigError,
  EmbeddingDimensionMismatchError,
  EmbeddingError,
  EmbeddingInvalidResponseError,
  EmbeddingTimeoutError,
} from './errors';

/**
 * Voyage AI — Anthropic's recommended embedding partner (no first-party
 * Anthropic embedding API exists), reached via a plain `fetch` call rather
 * than an SDK dependency: Voyage's embeddings endpoint is a single simple
 * REST call, and adding a whole SDK for one endpoint would be exactly the
 * unnecessary dependency the Phase 3 directive warns against.
 */
export const VOYAGE_DIMENSIONS = 1024;
export const DEFAULT_VOYAGE_MODEL = 'voyage-3';
const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings';
const DEFAULT_TIMEOUT_MS = 20_000;

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'voyage';
  readonly model: string;
  readonly dimensions = VOYAGE_DIMENSIONS;
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

    let res: Response;
    try {
      res = await fetch(VOYAGE_EMBEDDINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ input: texts, model: this.model, input_type: opts.inputType ?? 'document' }),
        signal: controller.signal,
      });
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
    if (!Array.isArray(body?.data)) {
      throw new EmbeddingInvalidResponseError();
    }

    // Voyage documents the response as index-ordered, but sort explicitly
    // rather than trust that — never assume provider response ordering.
    const vectors = [...body.data]
      .sort((a: any, b: any) => (a?.index ?? 0) - (b?.index ?? 0))
      .map((d: any) => d?.embedding);

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

let cached: { provider: VoyageEmbeddingProvider; key: string; model: string } | null = null;

/** Lazily constructed at request time, never at module-evaluation time —
 *  same discipline as src/server/ai/providers/anthropic.ts's
 *  getAnthropicProvider(), for the same reason (avoid the circular-import
 *  hazard class Phase 1 already hit once from eager top-level evaluation). */
export function getVoyageEmbeddingProvider(): VoyageEmbeddingProvider {
  const apiKey = process.env.VOYAGE_API_KEY || '';
  const model = process.env.EMBEDDING_MODEL || DEFAULT_VOYAGE_MODEL;
  if (!apiKey) {
    throw new EmbeddingConfigError('VOYAGE_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model) return cached.provider;
  cached = { provider: new VoyageEmbeddingProvider(apiKey, model), key: apiKey, model };
  return cached.provider;
}
