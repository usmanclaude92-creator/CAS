import type { SpeechToTextProvider } from './types.js';
import { getOpenAiSttProvider, DEFAULT_WHISPER_MODEL } from './openai.js';
import { SttConfigError } from './errors.js';

export type { SpeechToTextProvider, TranscribeOptions, TranscribeResult } from './types.js';
export { SttError, SttConfigError, SttTimeoutError, SttInvalidResponseError, SttUnsupportedFormatError } from './errors.js';

/** Picks the configured STT provider by STT_PROVIDER (default "openai").
 *  Called per-request, never at module-evaluation time. */
export function getSttProvider(): SpeechToTextProvider {
  const name = (process.env.STT_PROVIDER || 'openai').trim().toLowerCase();
  switch (name) {
    case 'openai':
      return getOpenAiSttProvider();
    default:
      throw new SttConfigError(`Unknown STT_PROVIDER "${name}".`);
  }
}

export function getConfiguredSttModelName(): string {
  return process.env.STT_MODEL || DEFAULT_WHISPER_MODEL;
}
