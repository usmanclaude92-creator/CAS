import type { TextToSpeechProvider } from './types.js';
import { getOpenAiTtsProvider, DEFAULT_TTS_MODEL } from './openai.js';
import { TtsConfigError } from './errors.js';

export type { TextToSpeechProvider, SynthesizeOptions, SynthesizeResult } from './types.js';
export { TtsError, TtsConfigError, TtsTimeoutError, TtsInvalidResponseError } from './errors.js';

export function getTtsProvider(): TextToSpeechProvider {
  const name = (process.env.TTS_PROVIDER || 'openai').trim().toLowerCase();
  switch (name) {
    case 'openai':
      return getOpenAiTtsProvider();
    default:
      throw new TtsConfigError(`Unknown TTS_PROVIDER "${name}".`);
  }
}

export function getConfiguredTtsModelName(): string {
  return process.env.TTS_MODEL || DEFAULT_TTS_MODEL;
}
