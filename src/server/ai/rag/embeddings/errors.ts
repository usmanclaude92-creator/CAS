/** Mirrors src/server/ai/providers/errors.ts — safe, categorized errors so
 *  no raw provider exception (which could include request/response bodies)
 *  ever reaches an API caller or gets logged with sensitive detail. */
export type EmbeddingErrorCategory = 'config' | 'timeout' | 'invalid_response' | 'dimension_mismatch' | 'request_failed';

export class EmbeddingError extends Error {
  readonly category: EmbeddingErrorCategory;
  constructor(category: EmbeddingErrorCategory, message: string) {
    super(message);
    this.name = 'EmbeddingError';
    this.category = category;
  }
}

export class EmbeddingConfigError extends EmbeddingError {
  constructor(message: string) {
    super('config', message);
    this.name = 'EmbeddingConfigError';
  }
}

export class EmbeddingTimeoutError extends EmbeddingError {
  constructor(message = 'The embedding provider did not respond in time.') {
    super('timeout', message);
    this.name = 'EmbeddingTimeoutError';
  }
}

export class EmbeddingInvalidResponseError extends EmbeddingError {
  constructor(message = 'The embedding provider returned an unexpected response shape.') {
    super('invalid_response', message);
    this.name = 'EmbeddingInvalidResponseError';
  }
}

export class EmbeddingDimensionMismatchError extends EmbeddingError {
  constructor(expected: number, actual: number) {
    super('dimension_mismatch', `Expected a ${expected}-dimension embedding, got ${actual}.`);
    this.name = 'EmbeddingDimensionMismatchError';
  }
}
