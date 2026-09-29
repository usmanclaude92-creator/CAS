/** Provider-agnostic text-to-speech abstraction — mirrors SttProvider. */
export interface SynthesizeOptions {
  voice?: string;
  /** Output audio format, e.g. "mp3". */
  format?: string;
  timeoutMs?: number;
}

export interface SynthesizeResult {
  audio: Buffer;
  mimeType: string;
}

export interface TextToSpeechProvider {
  readonly name: string;
  readonly model: string;
  synthesize(text: string, opts?: SynthesizeOptions): Promise<SynthesizeResult>;
}
