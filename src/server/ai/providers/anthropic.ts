import Anthropic from '@anthropic-ai/sdk';
import type {
  AiProvider,
  ContentBlock,
  ProviderRequest,
  ProviderResponse,
  ProviderStopReason,
  SendMessageOptions,
} from './types.js';
import { ProviderConfigError, ProviderInvalidResponseError, ProviderTimeoutError, ProviderError } from './errors.js';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';

const STOP_REASON_MAP: Record<string, ProviderStopReason> = {
  end_turn: 'end_turn',
  tool_use: 'tool_use',
  max_tokens: 'max_tokens',
  stop_sequence: 'stop_sequence',
};

function toAnthropicContent(blocks: ContentBlock[]): Anthropic.Messages.ContentBlockParam[] {
  return blocks.map((block): Anthropic.Messages.ContentBlockParam => {
    if (block.type === 'text') {
      return { type: 'text', text: block.text };
    }
    if (block.type === 'tool_use') {
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    }
    return {
      type: 'tool_result',
      tool_use_id: block.toolUseId,
      content: block.content,
      is_error: block.isError,
    };
  });
}

function fromAnthropicContent(blocks: Anthropic.Messages.ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      result.push({ type: 'text', text: block.text });
    } else if (block.type === 'tool_use') {
      result.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
    }
    // Other Anthropic block types (thinking, server tool use, etc.) are not
    // part of Phase 2's provider-agnostic contract — silently dropped rather
    // than surfaced as an unrecognized shape, since none affect tool dispatch.
  }
  return result;
}

/**
 * The only file in Phase 2 that imports @anthropic-ai/sdk. Everything else
 * (runtime.ts, router.ts) depends on the AiProvider interface in ./types,
 * so swapping or adding a provider never touches tool-dispatch or security
 * logic — see docs/ai/CAS-AI-PHASE-2.md.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
    this.model = model;
  }

  async sendMessage(request: ProviderRequest, opts: SendMessageOptions): Promise<ProviderResponse> {
    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
          tools: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema as Anthropic.Messages.Tool.InputSchema,
          })),
        },
        { timeout: opts.timeoutMs }
      );

      const stopReason = response.stop_reason ? STOP_REASON_MAP[response.stop_reason] ?? 'other' : 'other';
      return {
        content: fromAnthropicContent(response.content),
        stopReason,
        usage: response.usage
          ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
          : undefined,
      };
    } catch (err: any) {
      if (err?.name === 'APIConnectionTimeoutError' || err?.name === 'AbortError') {
        throw new ProviderTimeoutError();
      }
      if (err instanceof ProviderError) throw err;
      // Anthropic.APIError and anything else — never let the raw SDK error
      // (which may include request/response bodies) reach the caller.
      throw new ProviderInvalidResponseError(
        typeof err?.status === 'number' ? `AI provider request failed (HTTP ${err.status}).` : 'AI provider request failed.'
      );
    }
  }
}

let cached: { provider: AnthropicProvider; key: string; model: string } | null = null;

/**
 * Lazily constructed — never at module-evaluation time. Phase 1 already hit
 * one real bug from eager top-level evaluation touching a circular import;
 * this keeps provider construction (and its "is the API key set" check)
 * confined to request time, inside runtime.ts's own try/catch.
 */
export function getAnthropicProvider(): AnthropicProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const model = process.env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL;
  if (!apiKey) {
    throw new ProviderConfigError('ANTHROPIC_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model) return cached.provider;
  cached = { provider: new AnthropicProvider(apiKey, model), key: apiKey, model };
  return cached.provider;
}
