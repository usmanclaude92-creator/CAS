import type { TextToSpeechProvider } from './types';
import { getOpenAiTtsProvider, DEFAULT_TTS_MODEL } from './openai';
import { TtsConfigError } from './errors';

export type { TextToSpeechProvider, SynthesizeOptions, SynthesizeResult } from './types';
export { TtsError, TtsConfigError, TtsTimeoutError, TtsInvalidResponseError } from './errors';

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
