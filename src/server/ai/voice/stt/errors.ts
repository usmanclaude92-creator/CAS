/** Mirrors src/server/ai/providers/errors.ts and rag/embeddings/errors.ts —
 *  safe, categorized errors so no raw provider exception ever reaches an
 *  API caller or gets logged with sensitive detail. */
export type SttErrorCategory = 'config' | 'timeout' | 'invalid_response' | 'unsupported_format' | 'request_failed';

export class SttError extends Error {
  readonly category: SttErrorCategory;
  constructor(category: SttErrorCategory, message: string) {
    super(message);
    this.name = 'SttError';
    this.category = category;
  }
}

export class SttConfigError extends SttError {
  constructor(message: string) {
    super('config', message);
    this.name = 'SttConfigError';
  }
}

export class SttTimeoutError extends SttError {
  constructor(message = 'The speech-to-text provider did not respond in time.') {
    super('timeout', message);
    this.name = 'SttTimeoutError';
  }
}

export class SttInvalidResponseError extends SttError {
  constructor(message = 'The speech-to-text provider returned an unexpected response shape.') {
    super('invalid_response', message);
    this.name = 'SttInvalidResponseError';
  }
}

export class SttUnsupportedFormatError extends SttError {
  constructor(message = 'Unsupported audio format.') {
    super('unsupported_format', message);
    this.name = 'SttUnsupportedFormatError';
  }
}
