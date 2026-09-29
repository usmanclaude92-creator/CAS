export type TtsErrorCategory = 'config' | 'timeout' | 'invalid_response' | 'text_too_long' | 'request_failed';

export class TtsError extends Error {
  readonly category: TtsErrorCategory;
  constructor(category: TtsErrorCategory, message: string) {
    super(message);
    this.name = 'TtsError';
    this.category = category;
  }
}

export class TtsConfigError extends TtsError {
  constructor(message: string) {
    super('config', message);
    this.name = 'TtsConfigError';
  }
}

export class TtsTimeoutError extends TtsError {
  constructor(message = 'The text-to-speech provider did not respond in time.') {
    super('timeout', message);
    this.name = 'TtsTimeoutError';
  }
}

export class TtsInvalidResponseError extends TtsError {
  constructor(message = 'The text-to-speech provider returned an unexpected response.') {
    super('invalid_response', message);
    this.name = 'TtsInvalidResponseError';
  }
}
