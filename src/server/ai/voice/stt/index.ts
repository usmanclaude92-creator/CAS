import type { SpeechToTextProvider } from './types.js';
import { getOpenAiSttProvider, DEFAULT_WHISPER_MODEL } from './openai.js';
import { getGeminiSttProvider, DEFAULT_GEMINI_STT_MODEL } from './gemini.js';
import { SttConfigError } from './errors.js';

export type { SpeechToTextProvider, TranscribeOptions, TranscribeResult } from './types.js';
export { SttError, SttConfigError, SttTimeoutError, SttInvalidResponseError, SttUnsupportedFormatError } from './errors.js';

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  openai: DEFAULT_WHISPER_MODEL,
  gemini: DEFAULT_GEMINI_STT_MODEL,
};

/** Picks the configured STT provider by STT_PROVIDER (default "openai").
 *  Called per-request, never at module-evaluation time. */
export function getSttProvider(): SpeechToTextProvider {
  const name = (process.env.STT_PROVIDER || 'openai').trim().toLowerCase();
  switch (name) {
    case 'openai':
      return getOpenAiSttProvider();
    case 'gemini':
      return getGeminiSttProvider();
    default:
      throw new SttConfigError(`Unknown STT_PROVIDER "${name}".`);
  }
}

export function getConfiguredSttModelName(): string {
  const provider = (process.env.STT_PROVIDER || 'openai').trim().toLowerCase();
  return process.env.STT_MODEL || DEFAULT_MODEL_BY_PROVIDER[provider] || DEFAULT_WHISPER_MODEL;
}
