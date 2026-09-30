import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Only the Anthropic SDK's `messages.create` call is mocked — everything
 * else (the block-shape conversion in anthropic.ts, `toAnthropicContent`)
 * runs for real, so these tests prove the actual multimodal wiring: an
 * ImageBlock/DocumentBlock from src/server/ai/providers/types.ts is
 * converted into exactly the shape Claude's Messages API expects for native
 * vision/PDF input (see docs/ai/CAS-AI-PHASE-4.md).
 */
const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    messages = { create: mocks.create };
  },
}));

import { AnthropicProvider } from './anthropic';
import type { ProviderMessage } from './types';

beforeEach(() => {
  mocks.create.mockReset();
  mocks.create.mockResolvedValue({
    content: [{ type: 'text', text: 'ok' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 },
  });
});

async function sendWithMessages(messages: ProviderMessage[]) {
  const provider = new AnthropicProvider('test-key', 'test-model');
  await provider.sendMessage({ system: 'sys', messages, tools: [], maxTokens: 100 }, { timeoutMs: 1000 });
  return mocks.create.mock.calls[0][0];
}

describe('AnthropicProvider — multimodal content block conversion (Phase 4)', () => {
  it('converts an ImageBlock into a base64 image content param alongside the text', async () => {
    const request = await sendWithMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image', mediaType: 'image/png', data: 'QkFTRTY0REFUQQ==' },
        ],
      },
    ]);
    expect(request.messages[0].content).toEqual([
      { type: 'text', text: 'What is this?' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QkFTRTY0REFUQQ==' } },
    ]);
  });

  it('converts a DocumentBlock into a base64 PDF document content param, carrying the title through', async () => {
    const request = await sendWithMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Summarize this' },
          { type: 'document', mediaType: 'application/pdf', data: 'UERGREFUQQ==', title: 'invoice.pdf' },
        ],
      },
    ]);
    expect(request.messages[0].content[1]).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'UERGREFUQQ==' },
      title: 'invoice.pdf',
    });
  });

  it('defaults an untitled DocumentBlock\'s title to null (never undefined, never a made-up name)', async () => {
    const request = await sendWithMessages([
      { role: 'user', content: [{ type: 'document', mediaType: 'application/pdf', data: 'UERGREFUQQ==' }] },
    ]);
    expect(request.messages[0].content[0].title).toBeNull();
  });

  it('preserves multiple attachments on the same turn in order', async () => {
    const request = await sendWithMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Compare these' },
          { type: 'image', mediaType: 'image/jpeg', data: 'aW1nMQ==' },
          { type: 'image', mediaType: 'image/jpeg', data: 'aW1nMg==' },
        ],
      },
    ]);
    expect(request.messages[0].content).toHaveLength(3);
    expect(request.messages[0].content[1].source.data).toBe('aW1nMQ==');
    expect(request.messages[0].content[2].source.data).toBe('aW1nMg==');
  });
});
