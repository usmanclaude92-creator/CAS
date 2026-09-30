/**
 * Server-side audio validation — never trusts the client-declared MIME type
 * alone. `sniffAudioFormat` reads the actual container's magic bytes; a
 * declared MIME that contradicts what the bytes actually are is rejected,
 * not silently accepted.
 */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_AUDIO_DURATION_SECONDS = 120; // best-effort — see note below

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
] as const;

/** Canonical MIME per sniffed container — used to normalize a declared MIME
 *  like "audio/x-wav" to the one the STT provider expects. */
function sniffAudioFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // WebM/Matroska (EBML header): 1A 45 DF A3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'audio/webm';
  }
  // WAV: "RIFF"....×"WAVE"
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return 'audio/wav';
  }
  // OGG: "OggS"
  if (buffer.toString('ascii', 0, 4) === 'OggS') {
    return 'audio/ogg';
  }
  // MP3: ID3 tag, or an MPEG frame sync (11 set bits)
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    return 'audio/mpeg';
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  // MP4/M4A (ISO base media file format): bytes 4-7 are "ftyp"
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'audio/mp4';
  }
  return null;
}

export type AudioValidationResult = { ok: true; mimeType: string } | { ok: false; error: string };

export function validateAudioUpload(buffer: Buffer, declaredMimeType: string): AudioValidationResult {
  if (!buffer || buffer.length === 0) {
    return { ok: false, error: 'Audio file is empty.' };
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    return { ok: false, error: `Audio file exceeds the ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))}MB limit.` };
  }
  if (!ALLOWED_AUDIO_MIME_TYPES.includes(declaredMimeType as any)) {
    return { ok: false, error: `Unsupported audio type "${declaredMimeType}".` };
  }

  const sniffed = sniffAudioFormat(buffer);
  if (!sniffed) {
    // Not a container this sniffer recognizes at all — reject rather than
    // trust the declared MIME blindly for an unrecognized byte stream.
    return { ok: false, error: 'Could not verify the uploaded file is a supported audio format.' };
  }
  // The declared type and the sniffed type must at least agree on family
  // (e.g. both "audio/mp4"-ish) — normalize a couple of known aliases
  // before comparing, rather than requiring an exact string match that
  // would reject legitimate "audio/x-wav" vs "audio/wav" mismatches.
  const normalizedDeclared = declaredMimeType === 'audio/x-wav' ? 'audio/wav' : declaredMimeType === 'audio/mp3' ? 'audio/mpeg' : declaredMimeType === 'audio/m4a' ? 'audio/mp4' : declaredMimeType;
  if (normalizedDeclared !== sniffed) {
    return { ok: false, error: 'Uploaded file content does not match its declared audio type.' };
  }

  return { ok: true, mimeType: sniffed };
}
