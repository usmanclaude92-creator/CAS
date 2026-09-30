import { describe, it, expect } from 'vitest';
import { validateAudioUpload, MAX_AUDIO_BYTES, MAX_AUDIO_DURATION_SECONDS, ALLOWED_AUDIO_MIME_TYPES } from './validation';

function webmBuffer(size = 32): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  return buf;
}

function wavBuffer(size = 32): Buffer {
  const buf = Buffer.alloc(size);
  buf.write('RIFF', 0, 'ascii');
  buf.write('WAVE', 8, 'ascii');
  return buf;
}

describe('validateAudioUpload', () => {
  it('accepts a genuine WebM container declared as audio/webm', () => {
    const result = validateAudioUpload(webmBuffer(), 'audio/webm');
    expect(result).toEqual({ ok: true, mimeType: 'audio/webm' });
  });

  it('accepts a genuine WAV container declared as audio/wav', () => {
    const result = validateAudioUpload(wavBuffer(), 'audio/wav');
    expect(result).toEqual({ ok: true, mimeType: 'audio/wav' });
  });

  it('normalizes a known alias (audio/x-wav) against the sniffed audio/wav type', () => {
    const result = validateAudioUpload(wavBuffer(), 'audio/x-wav');
    expect(result).toEqual({ ok: true, mimeType: 'audio/wav' });
  });

  it('rejects an empty buffer', () => {
    const result = validateAudioUpload(Buffer.alloc(0), 'audio/webm');
    expect(result.ok).toBe(false);
  });

  it('rejects a buffer over MAX_AUDIO_BYTES', () => {
    const oversized = webmBuffer(MAX_AUDIO_BYTES + 1);
    const result = validateAudioUpload(oversized, 'audio/webm');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/exceeds/i);
  });

  it('rejects a declared MIME type outside the allow-list, regardless of content', () => {
    const result = validateAudioUpload(webmBuffer(), 'audio/flac');
    expect(result.ok).toBe(false);
  });

  it('rejects content whose magic bytes are not a recognized audio container at all', () => {
    const result = validateAudioUpload(Buffer.from('not audio, just some plain bytes here'), 'audio/webm');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/verify/i);
  });

  it('never trusts a declared MIME type that contradicts the actual sniffed container — this is the core security property', () => {
    // Genuine WAV bytes, but the client CLAIMS it's WebM.
    const result = validateAudioUpload(wavBuffer(), 'audio/webm');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/does not match/i);
  });

  it('exposes the allow-list and a sane, finite duration bound for the frontend/UX to mirror', () => {
    expect(ALLOWED_AUDIO_MIME_TYPES).toContain('audio/webm');
    expect(MAX_AUDIO_DURATION_SECONDS).toBeGreaterThan(0);
  });
});
