import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { OpenAiTtsProvider, getOpenAiTtsProvider, DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } from './openai';
import { TtsConfigError, TtsError, TtsInvalidResponseError, TtsTimeoutError } from './errors';

describe('OpenAiTtsProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('synthesizes text into audio bytes with the default mp3 mime type', async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]).buffer;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => fakeAudio }) as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    const result = await provider.synthesize('Your balance is 100.');
    expect(result.mimeType).toBe('audio/mpeg');
    expect(Buffer.compare(result.audio, Buffer.from(fakeAudio))).toBe(0);
  });

  it('sends the model, default voice, and JSON body to the OpenAI speech endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
    global.fetch = fetchMock as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    await provider.synthesize('hello');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(init.headers.Authorization).toBe('Bearer key');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ model: 'tts-1', input: 'hello', voice: 'alloy', response_format: 'mp3' });
  });

  it('honors an explicit voice override', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
    global.fetch = fetchMock as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    await provider.synthesize('hello', { voice: 'nova' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.voice).toBe('nova');
  });

  it('never sends anything but the given text — no system prompt or tool internals are appended', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
    global.fetch = fetchMock as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    await provider.synthesize('Your outstanding balance is 250.');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.input).toBe('Your outstanding balance is 250.');
  });

  it('throws TtsInvalidResponseError when the provider returns no audio bytes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    await expect(provider.synthesize('x')).rejects.toBeInstanceOf(TtsInvalidResponseError);
  });

  it('throws TtsInvalidResponseError when reading the audio body fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => {
        throw new Error('stream error');
      },
    }) as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    await expect(provider.synthesize('x')).rejects.toBeInstanceOf(TtsInvalidResponseError);
  });

  it('wraps a non-2xx HTTP response as a safe TtsError without leaking the response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    await expect(provider.synthesize('x')).rejects.toBeInstanceOf(TtsError);
  });

  it('maps an aborted request to TtsTimeoutError', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }) as any;
    const provider = new OpenAiTtsProvider('key', 'tts-1', 'alloy');
    await expect(provider.synthesize('x', { timeoutMs: 5 })).rejects.toBeInstanceOf(TtsTimeoutError);
  });
});

describe('getOpenAiTtsProvider — configuration', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.TTS_MODEL;
    delete process.env.TTS_VOICE;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws TtsConfigError when OPENAI_API_KEY is not set — never a fake/hard-coded fallback', () => {
    expect(() => getOpenAiTtsProvider()).toThrow(TtsConfigError);
  });

  it('constructs a provider once configured, defaulting model and voice', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const provider = getOpenAiTtsProvider();
    expect(provider.model).toBe(DEFAULT_TTS_MODEL);
    expect((provider as any).defaultVoice).toBe(DEFAULT_TTS_VOICE);
  });

  it('honors configured TTS_MODEL/TTS_VOICE overrides', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.TTS_MODEL = 'tts-custom';
    process.env.TTS_VOICE = 'shimmer';
    const provider = getOpenAiTtsProvider();
    expect(provider.model).toBe('tts-custom');
    expect((provider as any).defaultVoice).toBe('shimmer');
  });
});
