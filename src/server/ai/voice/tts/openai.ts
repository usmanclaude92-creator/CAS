import type { SynthesizeOptions, SynthesizeResult, TextToSpeechProvider } from './types';
import { TtsConfigError, TtsError, TtsInvalidResponseError, TtsTimeoutError } from './errors';

/** OpenAI TTS — same rationale as the Whisper STT provider: no first-party
 *  Anthropic TTS API exists; one REST endpoint, plain `fetch`, no SDK. */
export const DEFAULT_TTS_MODEL = 'tts-1';
export const DEFAULT_TTS_VOICE = 'alloy';
const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const DEFAULT_TIMEOUT_MS = 30_000;

export class OpenAiTtsProvider implements TextToSpeechProvider {
  readonly name = 'openai';
  readonly model: string;
  private readonly apiKey: string;
  private readonly defaultVoice: string;

  constructor(apiKey: string, model: string, defaultVoice: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.defaultVoice = defaultVoice;
  }

  async synthesize(text: string, opts: SynthesizeOptions = {}): Promise<SynthesizeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(OPENAI_SPEECH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: opts.voice ?? this.defaultVoice,
          response_format: opts.format ?? 'mp3',
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new TtsTimeoutError();
      throw new TtsError('request_failed', 'Failed to reach the text-to-speech provider.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new TtsError('request_failed', `Text-to-speech provider request failed (HTTP ${res.status}).`);
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await res.arrayBuffer();
    } catch {
      throw new TtsInvalidResponseError();
    }
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new TtsInvalidResponseError('Text-to-speech provider returned no audio.');
    }

    const format = opts.format ?? 'mp3';
    return { audio: Buffer.from(arrayBuffer), mimeType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}` };
  }
}

let cached: { provider: OpenAiTtsProvider; key: string; model: string; voice: string } | null = null;

export function getOpenAiTtsProvider(): OpenAiTtsProvider {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.TTS_MODEL || DEFAULT_TTS_MODEL;
  const voice = process.env.TTS_VOICE || DEFAULT_TTS_VOICE;
  if (!apiKey) {
    throw new TtsConfigError('OPENAI_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model && cached.voice === voice) return cached.provider;
  cached = { provider: new OpenAiTtsProvider(apiKey, model, voice), key: apiKey, model, voice };
  return cached.provider;
}
