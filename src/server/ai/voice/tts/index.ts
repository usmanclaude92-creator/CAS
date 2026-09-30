import type { TextToSpeechProvider } from './types.js';
import { getOpenAiTtsProvider, DEFAULT_TTS_MODEL } from './openai.js';
import { getGeminiTtsProvider, DEFAULT_GEMINI_TTS_MODEL } from './gemini.js';
import { TtsConfigError } from './errors.js';

export type { TextToSpeechProvider, SynthesizeOptions, SynthesizeResult } from './types.js';
export { TtsError, TtsConfigError, TtsTimeoutError, TtsInvalidResponseError } from './errors.js';

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  openai: DEFAULT_TTS_MODEL,
  gemini: DEFAULT_GEMINI_TTS_MODEL,
};

export function getTtsProvider(): TextToSpeechProvider {
  const name = (process.env.TTS_PROVIDER || 'openai').trim().toLowerCase();
  switch (name) {
    case 'openai':
      return getOpenAiTtsProvider();
    case 'gemini':
      return getGeminiTtsProvider();
    default:
      throw new TtsConfigError(`Unknown TTS_PROVIDER "${name}".`);
  }
}

export function getConfiguredTtsModelName(): string {
  const provider = (process.env.TTS_PROVIDER || 'openai').trim().toLowerCase();
  return process.env.TTS_MODEL || DEFAULT_MODEL_BY_PROVIDER[provider] || DEFAULT_TTS_MODEL;
}
