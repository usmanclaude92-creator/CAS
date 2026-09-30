import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from './gemini';
import { ProviderConfigError, ProviderInvalidResponseError, ProviderTimeoutError } from './errors';
import type { ProviderMessage } from './types';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

async function send(messages: ProviderMessage[], tools: any[] = []) {
  const provider = new GeminiProvider('test-key', 'test-model');
  return provider.sendMessage({ system: 'sys', messages, tools, maxTokens: 100 }, { timeoutMs: 1000 });
}

describe('GeminiProvider — request/response conversion', () => {
  it('sends system instruction, contents, and generationConfig to the generateContent endpoint', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
      })
    );

    const result = await send([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('models/test-model:generateContent');
    expect(url).toContain('key=test-key');
    const body = JSON.parse(init.body);
    expect(body.system_instruction).toEqual({ parts: [{ text: 'sys' }] });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
    expect(body.generationConfig).toEqual({ maxOutputTokens: 100 });
    expect(body.tools).toBeUndefined();

    expect(result).toEqual({
      content: [{ type: 'text', text: 'ok' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 5, outputTokens: 2 },
    });
  });

  it('maps assistant role to "model" and converts image/document blocks to inlineData', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }));

    await send([
      { role: 'assistant', content: [{ type: 'text', text: 'prior reply' }] },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this?' },
          { type: 'image', mediaType: 'image/png', data: 'aW1nMQ==' },
          { type: 'document', mediaType: 'application/pdf', data: 'cGRmMQ==', title: 'invoice.pdf' },
        ],
      },
    ]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.contents[0]).toEqual({ role: 'model', parts: [{ text: 'prior reply' }] });
    expect(body.contents[1].parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'aW1nMQ==' } });
    expect(body.contents[1].parts[2]).toEqual({ inlineData: { mimeType: 'application/pdf', data: 'cGRmMQ==' } });
  });

  it('sends functionDeclarations for tools and parses a functionCall response as tool_use with stopReason tool_use', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        candidates: [
          { content: { parts: [{ functionCall: { name: 'get_vendor_balance', args: { vendorId: 'v1' } } }] }, finishReason: 'STOP' },
        ],
      })
    );

    const result = await send(
      [{ role: 'user', content: [{ type: 'text', text: 'balance?' }] }],
      [{ name: 'get_vendor_balance', description: 'desc', inputSchema: { type: 'object', properties: {} } }]
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      { functionDeclarations: [{ name: 'get_vendor_balance', description: 'desc', parameters: { type: 'object', properties: {} } }] },
    ]);

    expect(result.stopReason).toBe('tool_use');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('tool_use');
    expect((result.content[0] as any).name).toBe('get_vendor_balance');
    expect((result.content[0] as any).input).toEqual({ vendorId: 'v1' });
    expect(typeof (result.content[0] as any).id).toBe('string');
  });

  it('resolves the original function name for a tool_result by scanning back through prior tool_use blocks', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' }] }));

    await send([
      { role: 'user', content: [{ type: 'text', text: 'balance?' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'call-1', name: 'get_vendor_balance', input: { vendorId: 'v1' } }] },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 'call-1', content: '{"balance":100}' }] },
    ]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.contents[2]).toEqual({
      role: 'user',
      parts: [{ functionResponse: { name: 'get_vendor_balance', response: { result: '{"balance":100}' } } }],
    });
  });

  it('marks an error tool_result with a response.error field', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' }] }));

    await send([
      { role: 'assistant', content: [{ type: 'tool_use', id: 'call-1', name: 'get_vendor_balance', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 'call-1', content: 'boom', isError: true }] },
    ]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.contents[1].parts[0]).toEqual({
      functionResponse: { name: 'get_vendor_balance', response: { error: 'boom' } },
    });
  });

  it('throws ProviderInvalidResponseError when no candidate is returned (safety-blocked)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ candidates: [] }));
    await expect(send([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }])).rejects.toBeInstanceOf(
      ProviderInvalidResponseError
    );
  });

  it('throws ProviderInvalidResponseError on a non-ok HTTP response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, false, 500));
    await expect(send([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }])).rejects.toBeInstanceOf(
      ProviderInvalidResponseError
    );
  });

  it('throws ProviderTimeoutError when the request is aborted', async () => {
    mockFetch.mockImplementation(() => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    await expect(send([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }])).rejects.toBeInstanceOf(ProviderTimeoutError);
  });
});

describe('getGeminiProvider', () => {
  it('throws ProviderConfigError when GOOGLE_AI_API_KEY is not set', async () => {
    const original = process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    const { getGeminiProvider } = await import('./gemini');
    expect(() => getGeminiProvider()).toThrow(ProviderConfigError);
    if (original) process.env.GOOGLE_AI_API_KEY = original;
  });
});
