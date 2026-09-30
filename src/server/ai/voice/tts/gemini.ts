import type { SynthesizeOptions, SynthesizeResult, TextToSpeechProvider } from './types.js';
import { TtsConfigError, TtsError, TtsInvalidResponseError, TtsTimeoutError } from './errors.js';

/**
 * Gemini's native speech generation — same generateContent endpoint as
 * chat/STT, with responseModalities:["AUDIO"] and a prebuilt voice. Unlike
 * OpenAI's TTS endpoint (which returns a ready-to-play mp3), Gemini returns
 * raw headerless 16-bit PCM, which no browser <audio> element can play
 * directly — pcmToWav() below wraps it in a minimal WAV container before it
 * ever reaches the response the client turns into a Blob URL (see
 * src/services/aiVoiceService.ts).
 */
export const DEFAULT_GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
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

/** Gemini's inlineData.mimeType for audio looks like "audio/L16;rate=24000"
 *  — pulls the sample rate out, defaulting if the field is ever missing. */
function parseSampleRate(mimeType: string | undefined): number {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? parseInt(match[1], 10) : DEFAULT_SAMPLE_RATE;
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

    const pcm = Buffer.from(inlineData.data, 'base64');
    if (pcm.length === 0) {
      throw new TtsInvalidResponseError('Text-to-speech provider returned no audio.');
    }

    const sampleRate = parseSampleRate(inlineData.mimeType);
    return { audio: pcmToWav(pcm, sampleRate), mimeType: 'audio/wav' };
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
