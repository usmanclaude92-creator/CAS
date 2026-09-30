import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GeminiSttProvider, getGeminiSttProvider, DEFAULT_GEMINI_STT_MODEL } from './gemini';
import { SttConfigError, SttError, SttInvalidResponseError, SttTimeoutError } from './errors';

describe('GeminiSttProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('transcribes and returns the trimmed plain text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '  What is the balance for vendor ABC?  ' }] } }] }),
    }) as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    const result = await provider.transcribe(Buffer.from('fake-audio-bytes'), 'audio/webm');
    expect(result.text).toBe('What is the balance for vendor ABC?');
  });

  it('sends the audio as inlineData alongside a transcription instruction', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }) });
    global.fetch = fetchMock as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    await provider.transcribe(Buffer.from('abc'), 'audio/webm');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('models/gemini-2.5-flash:generateContent');
    expect(url).toContain('key=key');
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'audio/webm', data: Buffer.from('abc').toString('base64') } });
    expect(body.contents[0].parts[0].text).toContain('Transcribe');
  });

  it('forwards an optional language hint into the prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'bonjour' }] } }] }) });
    global.fetch = fetchMock as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    await provider.transcribe(Buffer.from('abc'), 'audio/webm', { language: 'fr' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toContain('fr');
  });

  it('throws SttInvalidResponseError when the response has no transcript text', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) }) as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttInvalidResponseError);
  });

  it('throws SttInvalidResponseError when the response body is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    }) as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttInvalidResponseError);
  });

  it('wraps a non-2xx HTTP response as a safe SttError without leaking the response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttError);
  });

  it('maps an aborted request to SttTimeoutError', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }) as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm', { timeoutMs: 5 })).rejects.toBeInstanceOf(SttTimeoutError);
  });

  it('maps a network failure to a safe SttError, never the raw fetch exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com')) as any;
    const provider = new GeminiSttProvider('key', 'gemini-2.5-flash');
    await expect(provider.transcribe(Buffer.from('a'), 'audio/webm')).rejects.toBeInstanceOf(SttError);
  });
});

describe('getGeminiSttProvider — configuration', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.STT_MODEL;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws SttConfigError when GOOGLE_AI_API_KEY is not set — never a fake/hard-coded fallback', () => {
    expect(() => getGeminiSttProvider()).toThrow(SttConfigError);
  });

  it('constructs a provider once configured, defaulting to the standard model', () => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    const provider = getGeminiSttProvider();
    expect(provider.model).toBe(DEFAULT_GEMINI_STT_MODEL);
  });

  it('honors a configured STT_MODEL override', () => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    process.env.STT_MODEL = 'gemini-custom';
    const provider = getGeminiSttProvider();
    expect(provider.model).toBe('gemini-custom');
  });
});
