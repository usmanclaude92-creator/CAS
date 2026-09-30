/**
 * Provider-agnostic speech-to-text abstraction — same pattern as the LLM
 * (src/server/ai/providers/) and embedding (src/server/ai/rag/embeddings/)
 * abstractions: src/server/ai/voice/transcribe.ts depends only on this
 * interface, never on a vendor SDK directly.
 */
export interface TranscribeOptions {
  /** ISO 639-1 language hint (e.g. "en") — optional, improves accuracy. */
  language?: string;
  timeoutMs?: number;
}

export interface TranscribeResult {
  text: string;
  language?: string;
  durationSeconds?: number;
}

export interface SpeechToTextProvider {
  readonly name: string;
  readonly model: string;
  transcribe(audio: Buffer, mimeType: string, opts?: TranscribeOptions): Promise<TranscribeResult>;
}
