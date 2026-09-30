import type { SpeechToTextProvider, TranscribeOptions, TranscribeResult } from './types.js';
import { SttConfigError, SttError, SttInvalidResponseError, SttTimeoutError } from './errors.js';

/**
 * Gemini has no dedicated speech-to-text endpoint — it transcribes via the
 * same multimodal generateContent call as chat, given the audio as inline
 * data alongside a transcription instruction. Plain `fetch`, no SDK — same
 * rationale as every other single-endpoint provider in this codebase.
 */
export const DEFAULT_GEMINI_STT_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 30_000;

function transcriptionPrompt(language?: string): string {
  const hint = language ? ` The spoken language is "${language}".` : '';
  return (
    'Transcribe the following audio recording exactly, word for word, in its original language.' +
    hint +
    ' Output ONLY the transcript text itself — no preamble, no commentary, no quotation marks, no formatting.'
  );
}

export class GeminiSttProvider implements SpeechToTextProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribe(audio: Buffer, mimeType: string, opts: TranscribeOptions = {}): Promise<TranscribeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: transcriptionPrompt(opts.language) }, { inlineData: { mimeType, data: audio.toString('base64') } }],
        },
      ],
      generationConfig: { temperature: 0 },
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
      if (err?.name === 'AbortError') throw new SttTimeoutError();
      throw new SttError('request_failed', 'Failed to reach the speech-to-text provider.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new SttError('request_failed', `Speech-to-text provider request failed (HTTP ${res.status}).`);
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new SttInvalidResponseError();
    }

    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || text.length === 0) {
      throw new SttInvalidResponseError();
    }

    return { text: text.trim(), language: opts.language };
  }
}

let cached: { provider: GeminiSttProvider; key: string; model: string } | null = null;

export function getGeminiSttProvider(): GeminiSttProvider {
  const apiKey = process.env.GOOGLE_AI_API_KEY || '';
  const model = process.env.STT_MODEL || DEFAULT_GEMINI_STT_MODEL;
  if (!apiKey) {
    throw new SttConfigError('GOOGLE_AI_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model) return cached.provider;
  cached = { provider: new GeminiSttProvider(apiKey, model), key: apiKey, model };
  return cached.provider;
}
