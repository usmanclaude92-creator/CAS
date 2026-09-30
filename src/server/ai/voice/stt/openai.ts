import type { SpeechToTextProvider, TranscribeOptions, TranscribeResult } from './types.js';
import { SttConfigError, SttError, SttInvalidResponseError, SttTimeoutError } from './errors.js';

/**
 * OpenAI Whisper — no first-party Anthropic speech-to-text API exists, so
 * this mirrors the Phase 3 embeddings decision (Voyage AI for the same
 * reason): a single, well-documented REST endpoint, reached via a plain
 * `fetch` + native `FormData`/`Blob` (both built into Node 18+), never an
 * SDK dependency for one endpoint.
 */
export const DEFAULT_WHISPER_MODEL = 'whisper-1';
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_TIMEOUT_MS = 30_000;

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

export class OpenAiSttProvider implements SpeechToTextProvider {
  readonly name = 'openai';
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribe(audio: Buffer, mimeType: string, opts: TranscribeOptions = {}): Promise<TranscribeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const form = new FormData();
    const ext = EXTENSION_BY_MIME[mimeType] ?? 'webm';
    form.append('file', new Blob([audio], { type: mimeType }), `audio.${ext}`);
    form.append('model', this.model);
    form.append('response_format', 'json');
    if (opts.language) form.append('language', opts.language);

    let res: Response;
    try {
      res = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new SttTimeoutError();
      throw new SttError('request_failed', 'Failed to reach the speech-to-text provider.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new SttError('request_failed', `Speech-to-text provider request failed (HTTP ${res.status}).`);
    }

    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new SttInvalidResponseError();
    }
    if (typeof body?.text !== 'string') {
      throw new SttInvalidResponseError();
    }

    return { text: body.text, language: body.language, durationSeconds: body.duration };
  }
}

let cached: { provider: OpenAiSttProvider; key: string; model: string } | null = null;

/** Lazily constructed at request time, never at module-evaluation time —
 *  same discipline as every other provider in this codebase. */
export function getOpenAiSttProvider(): OpenAiSttProvider {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.STT_MODEL || DEFAULT_WHISPER_MODEL;
  if (!apiKey) {
    throw new SttConfigError('OPENAI_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model) return cached.provider;
  cached = { provider: new OpenAiSttProvider(apiKey, model), key: apiKey, model };
  return cached.provider;
}
