import type { EmbeddingProvider } from './types.js';
import { getVoyageEmbeddingProvider, DEFAULT_VOYAGE_MODEL, VOYAGE_DIMENSIONS } from './voyage.js';
import { EmbeddingConfigError } from './errors.js';

export type { EmbeddingProvider, EmbedOptions, EmbeddingInputType } from './types.js';
export {
  EmbeddingError,
  EmbeddingConfigError,
  EmbeddingTimeoutError,
  EmbeddingInvalidResponseError,
  EmbeddingDimensionMismatchError,
} from './errors.js';

/** Picks the configured embedding provider by EMBEDDING_PROVIDER (default
 *  "voyage"). Called per-request, never at module-evaluation time. */
export function getEmbeddingProvider(): EmbeddingProvider {
  const name = (process.env.EMBEDDING_PROVIDER || 'voyage').trim().toLowerCase();
  switch (name) {
    case 'voyage':
      return getVoyageEmbeddingProvider();
    default:
      throw new EmbeddingConfigError(`Unknown EMBEDDING_PROVIDER "${name}".`);
  }
}

/** The dimension the knowledge_chunks.embedding column is pinned to
 *  (migration `20260929020000_add_knowledge_base_rag.sql`) — a future
 *  second provider with a different width requires a new migration to
 *  widen that column plus a full re-index, not just a config change. */
export function getConfiguredEmbeddingDimensions(): number {
  return VOYAGE_DIMENSIONS;
}

export function getConfiguredEmbeddingModelName(): string {
  return process.env.EMBEDDING_MODEL || DEFAULT_VOYAGE_MODEL;
}
