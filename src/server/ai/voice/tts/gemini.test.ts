import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GeminiTtsProvider, getGeminiTtsProvider, pcmToWav, DEFAULT_GEMINI_TTS_MODEL, DEFAULT_GEMINI_TTS_VOICE } from './gemini';
import { TtsConfigError, TtsError, TtsInvalidResponseError, TtsTimeoutError } from './errors';

describe('pcmToWav', () => {
  it('wraps raw PCM bytes in a 44-byte RIFF/WAVE header describing the given format', () => {
    const pcm = Buffer.from([1, 2, 3, 4]);
    const wav = pcmToWav(pcm, 24000, 1, 16);
    expect(wav.length).toBe(44 + pcm.length);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
    expect(wav.readUInt16LE(20)).toBe(1); // PCM format
    expect(wav.readUInt16LE(22)).toBe(1); // channels
    expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(wav.toString('ascii', 36, 40)).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
  });
});

describe('GeminiTtsProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function fakePcmResponse(pcmBase64: string, mimeType = 'audio/L16;rate=24000') {
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType, data: pcmBase64 } } ] } }] }),
    };
  }

  it('synthesizes text into a playable WAV container, not raw PCM', async () => {
    const pcm = Buffer.from([9, 9, 9, 9]);
    global.fetch = vi.fn().mockResolvedValue(fakePcmResponse(pcm.toString('base64'))) as any;
    const provider = new GeminiTtsProvider('key', 'tts-model', 'Kore');
    const result = await provider.synthesize('Your balance is 100.');
    expect(result.mimeType).toBe('audio/wav');
    expect(result.audio.toString('ascii', 0, 4)).toBe('RIFF');
    expect(result.audio.subarray(44)).toEqual(pcm);
  });

  it('reads the sample rate out of the returned mimeType', async () => {
    const pcm = Buffer.from([1, 2]);
    global.fetch = vi.fn().mockResolvedValue(fakePcmResponse(pcm.toString('base64'), 'audio/L16;rate=16000')) as any;
    const provider = new GeminiTtsProvider('key', 'tts-model', 'Kore');
    const result = await provider.synthesize('hi');
    expect(result.audio.readUInt32LE(24)).toBe(16000);
  });

  it('sends the model, voice config, and AUDIO response modality', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakePcmResponse(Buffer.from([1]).toString('base64')));
    global.fetch = fetchMock as any;
    const provider = new GeminiTtsProvider('key', 'tts-model', 'Kore');
    await provider.synthesize('hello');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('models/tts-model:generateContent');
    const body = JSON.parse(init.body);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hello' }] }]);
    expect(body.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore');
  });

  it('honors an explicit voice override', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakePcmResponse(Buffer.from([1]).toString('base64')));
    global.fetch = fetchMock as any;
    const provider = new GeminiTtsProvider('key', 'tts-model', 'Kore');
    await provider.synthesize('hello', { voice: 'Puck' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Puck');
  });

  it('throws TtsInvalidResponseError when the provider returns no audio bytes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{}] } }] }) }) as any;
    const provider = new GeminiTtsProvider('key', 'tts-model', 'Kore');
    await expect(provider.synthesize('x')).rejects.toBeInstanceOf(TtsInvalidResponseError);
  });

  it('wraps a non-2xx HTTP response as a safe TtsError without leaking the response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const provider = new GeminiTtsProvider('key', 'tts-model', 'Kore');
    await expect(provider.synthesize('x')).rejects.toBeInstanceOf(TtsError);
  });

  it('maps an aborted request to TtsTimeoutError', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }) as any;
    const provider = new GeminiTtsProvider('key', 'tts-model', 'Kore');
    await expect(provider.synthesize('x', { timeoutMs: 5 })).rejects.toBeInstanceOf(TtsTimeoutError);
  });
});

describe('getGeminiTtsProvider — configuration', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.TTS_MODEL;
    delete process.env.TTS_VOICE;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws TtsConfigError when GOOGLE_AI_API_KEY is not set — never a fake/hard-coded fallback', () => {
    expect(() => getGeminiTtsProvider()).toThrow(TtsConfigError);
  });

  it('constructs a provider once configured, defaulting model and voice', () => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    const provider = getGeminiTtsProvider();
    expect(provider.model).toBe(DEFAULT_GEMINI_TTS_MODEL);
    expect((provider as any).defaultVoice).toBe(DEFAULT_GEMINI_TTS_VOICE);
  });

  it('honors configured TTS_MODEL/TTS_VOICE overrides', () => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    process.env.TTS_MODEL = 'tts-custom';
    process.env.TTS_VOICE = 'Puck';
    const provider = getGeminiTtsProvider();
    expect(provider.model).toBe('tts-custom');
    expect((provider as any).defaultVoice).toBe('Puck');
  });
});
