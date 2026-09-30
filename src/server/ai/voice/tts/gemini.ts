import type { SynthesizeOptions, SynthesizeResult, TextToSpeechProvider } from './types.js';
import { TtsConfigError, TtsError, TtsInvalidResponseError, TtsTimeoutError } from './errors.js';

/**
 * Gemini's native speech generation — same generateContent endpoint as
 * chat/STT, with responseModalities:["AUDIO"] and a prebuilt voice.
 * gemini-3.8-flash-tts (verified live 2026-09-30) returns a complete,
 * self-contained audio/wav file — but the older gemini-2.5-*-preview-tts
 * models (still selectable via TTS_MODEL) return raw headerless 16-bit PCM,
 * which no browser <audio> element can play directly. synthesizeResult()
 * below detects which shape came back and only wraps with pcmToWav() when
 * the data isn't already a real container.
 */
export const DEFAULT_GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts';
export const DEFAULT_GEMINI_TTS_VOICE = 'Kore';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SAMPLE_RATE = 24_000;

/** Wraps raw PCM samples in a standard 44-byte RIFF/WAVE header — the
 *  smallest change that makes Gemini's audio output a file any browser
 *  <audio> element or media player can open. */
export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** A preview-model mimeType like "audio/L16;rate=24000" — pulls the sample
 *  rate out, defaulting if the field is ever missing. */
function parseSampleRate(mimeType: string | undefined): number {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? parseInt(match[1], 10) : DEFAULT_SAMPLE_RATE;
}

/** True for a mimeType that already names a self-contained, browser-playable
 *  container (wav/mpeg/ogg/...) — anything else (raw "audio/L16" PCM, or no
 *  mimeType at all) needs pcmToWav() before a browser can play it. */
function isContainerFormat(mimeType: string | undefined): boolean {
  return !!mimeType && /^audio\/(wav|wave|x-wav|mpeg|mp3|ogg|webm)\b/i.test(mimeType);
}

export class GeminiTtsProvider implements TextToSpeechProvider {
  readonly name = 'gemini';
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

    const body = {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice ?? this.defaultVoice } } },
      },
    };

    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new TtsTimeoutError();
      throw new TtsError('request_failed', 'Failed to reach the text-to-speech provider.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new TtsError('request_failed', `Text-to-speech provider request failed (HTTP ${res.status}).`);
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new TtsInvalidResponseError();
    }

    const inlineData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new TtsInvalidResponseError('Text-to-speech provider returned no audio.');
    }

    const bytes = Buffer.from(inlineData.data, 'base64');
    if (bytes.length === 0) {
      throw new TtsInvalidResponseError('Text-to-speech provider returned no audio.');
    }

    if (isContainerFormat(inlineData.mimeType)) {
      // The current stable TTS model already returns a complete file (e.g.
      // audio/wav) — wrapping it again would corrupt it with a second header.
      const mimeType = inlineData.mimeType!.split(';')[0].toLowerCase();
      return { audio: bytes, mimeType: mimeType === 'audio/mp3' ? 'audio/mpeg' : mimeType };
    }

    const sampleRate = parseSampleRate(inlineData.mimeType);
    return { audio: pcmToWav(bytes, sampleRate), mimeType: 'audio/wav' };
  }
}

let cached: { provider: GeminiTtsProvider; key: string; model: string; voice: string } | null = null;

export function getGeminiTtsProvider(): GeminiTtsProvider {
  const apiKey = process.env.GOOGLE_AI_API_KEY || '';
  const model = process.env.TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL;
  const voice = process.env.TTS_VOICE || DEFAULT_GEMINI_TTS_VOICE;
  if (!apiKey) {
    throw new TtsConfigError('GOOGLE_AI_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model && cached.voice === voice) return cached.provider;
  cached = { provider: new GeminiTtsProvider(apiKey, model, voice), key: apiKey, model, voice };
  return cached.provider;
}
