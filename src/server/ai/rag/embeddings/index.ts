import type { EmbeddingProvider } from './types.js';
import { getVoyageEmbeddingProvider, DEFAULT_VOYAGE_MODEL, VOYAGE_DIMENSIONS } from './voyage.js';
import { getGeminiEmbeddingProvider, DEFAULT_GEMINI_EMBEDDING_MODEL } from './gemini.js';
import { EmbeddingConfigError } from './errors.js';

export type { EmbeddingProvider, EmbedOptions, EmbeddingInputType } from './types.js';
export {
  EmbeddingError,
  EmbeddingConfigError,
  EmbeddingTimeoutError,
  EmbeddingInvalidResponseError,
  EmbeddingDimensionMismatchError,
} from './errors.js';

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  voyage: DEFAULT_VOYAGE_MODEL,
  gemini: DEFAULT_GEMINI_EMBEDDING_MODEL,
};

/** Picks the configured embedding provider by EMBEDDING_PROVIDER (default
 *  "voyage"). Called per-request, never at module-evaluation time. */
export function getEmbeddingProvider(): EmbeddingProvider {
  const name = (process.env.EMBEDDING_PROVIDER || 'voyage').trim().toLowerCase();
  switch (name) {
    case 'voyage':
      return getVoyageEmbeddingProvider();
    case 'gemini':
      return getGeminiEmbeddingProvider();
    default:
      throw new EmbeddingConfigError(`Unknown EMBEDDING_PROVIDER "${name}".`);
  }
}

/** The dimension the knowledge_chunks.embedding column is pinned to
 *  (migration `20260929020000_add_knowledge_base_rag.sql`) — every provider
 *  here is required to target this exact width (Gemini does so via its
 *  configurable outputDimensionality) so switching providers never needs a
 *  migration or re-index. A future provider that CAN'T match this width
 *  would need both. */
export function getConfiguredEmbeddingDimensions(): number {
  return VOYAGE_DIMENSIONS;
}

export function getConfiguredEmbeddingModelName(): string {
  const provider = (process.env.EMBEDDING_PROVIDER || 'voyage').trim().toLowerCase();
  return process.env.EMBEDDING_MODEL || DEFAULT_MODEL_BY_PROVIDER[provider] || DEFAULT_VOYAGE_MODEL;
}
