/**
 * Safe, categorized provider errors. src/server/ai/runtime.ts catches these
 * (never a raw SDK exception) and maps them to the error categories in
 * docs/ai/CAS-AI-PHASE-2.md §Error handling — the client never sees a stack
 * trace, an API key, or any other provider-internal detail.
 */
export type ProviderErrorCategory = 'config' | 'timeout' | 'rate_limit' | 'invalid_response' | 'request_failed';

export class ProviderError extends Error {
  readonly category: ProviderErrorCategory;

  constructor(category: ProviderErrorCategory, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.category = category;
  }
}

export class ProviderConfigError extends ProviderError {
  constructor(message: string) {
    super('config', message);
    this.name = 'ProviderConfigError';
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(message = 'The AI provider did not respond in time.') {
    super('timeout', message);
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderInvalidResponseError extends ProviderError {
  constructor(message = 'The AI provider returned an unexpected response shape.') {
    super('invalid_response', message);
    this.name = 'ProviderInvalidResponseError';
  }
}
