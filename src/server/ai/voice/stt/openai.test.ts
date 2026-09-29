import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { OpenAiSttProvider, getOpenAiSttProvider, DEFAULT_WHISPER_MODEL } from './openai';
import { SttConfigError, SttError, SttInvalidResponseError, SttTimeoutError } from './errors';

describe('OpenAiSttProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('transcribes and returns the plain text — a transcript, nothing that carries its own authority', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'What is the balance for vendor ABC?', language: 'en', duration: 3.2 }),
    }) as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    const result = await provider.transcribe(Buffer.from('fake-audio-bytes'), 'audio/webm');
    expect(result.text).toBe('What is the balance for vendor ABC?');
    expect(result.language).toBe('en');
    expect(result.durationSeconds).toBe(3.2);
  });

  it('sends the audio as multipart form data with the model and an audio/webm-derived filename', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'hi' }) });
    global.fetch = fetchMock as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    await provider.transcribe(Buffer.from('abc'), 'audio/webm');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer key');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('forwards an optional language hint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'bonjour' }) });
    global.fetch = fetchMock as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    await provider.transcribe(Buffer.from('abc'), 'audio/webm', { language: 'fr' });
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get('language')).toBe('fr');
  });

  it('throws SttInvalidResponseError when the response has no text field', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ oops: true }) }) as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttInvalidResponseError);
  });

  it('throws SttInvalidResponseError when the response body is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    }) as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttInvalidResponseError);
  });

  it('wraps a non-2xx HTTP response as a safe SttError without leaking the response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttError);
  });

  it('maps an aborted request to SttTimeoutError', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }) as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm', { timeoutMs: 5 })).rejects.toBeInstanceOf(SttTimeoutError);
  });

  it('maps a network failure to a safe SttError, never the raw fetch exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.openai.com')) as any;
    const provider = new OpenAiSttProvider('key', 'whisper-1');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttError);
  });
});

describe('getOpenAiSttProvider — configuration', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.STT_MODEL;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws SttConfigError when OPENAI_API_KEY is not set — never a fake/hard-coded fallback', () => {
    expect(() => getOpenAiSttProvider()).toThrow(SttConfigError);
  });

  it('constructs a provider once configured, defaulting to the whisper-1 model', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const provider = getOpenAiSttProvider();
    expect(provider.model).toBe(DEFAULT_WHISPER_MODEL);
  });

  it('honors a configured STT_MODEL override', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.STT_MODEL = 'whisper-custom';
    const provider = getOpenAiSttProvider();
    expect(provider.model).toBe('whisper-custom');
  });
});
