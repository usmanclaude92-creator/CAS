import type {
  AiProvider,
  ContentBlock,
  ProviderMessage,
  ProviderRequest,
  ProviderResponse,
  ProviderStopReason,
  SendMessageOptions,
  ToolSchema,
} from './types.js';
import { ProviderConfigError, ProviderInvalidResponseError, ProviderTimeoutError, ProviderError } from './errors.js';

// gemini-2.5-flash was retired ("no longer available to new users" — HTTP 404
// from Google's own API, confirmed live 2026-09-30); gemini-3.8-flash is
// Google's own recommended replacement as of that same response.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const FINISH_REASON_MAP: Record<string, ProviderStopReason> = {
  STOP: 'end_turn',
  MAX_TOKENS: 'max_tokens',
};

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: unknown };
  functionResponse?: { name: string; response: unknown };
  inlineData?: { mimeType: string; data: string };
  /**
   * Required on a "thinking" model's (e.g. gemini-3.8-flash) functionCall
   * part — Gemini rejects the next turn with HTTP 400 if a prior
   * functionCall is replayed without the exact thought_signature it was
   * issued with (confirmed live 2026-09-30; see
   * https://ai.google.dev/gemini-api/docs/thought-signatures). Carried
   * through our own ToolUseBlock.providerMetadata (see ./types.ts) purely
   * so it can be replayed here, never interpreted by runtime.ts.
   */
  thoughtSignature?: string;
}

interface GeminiContentEntry {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * Gemini's function-calling protocol has no call-id concept — a
 * functionResponse is matched to its functionCall by name, not id. Our own
 * runtime (src/server/ai/runtime.ts) always generates a fresh ToolUseBlock.id
 * purely to correlate its own ToolResultBlock on the next turn, and never
 * passes that id to a provider API — so a locally generated id is sufficient
 * here (Anthropic and OpenAI-style providers only differ in that their own
 * SDK/API happens to assign and expect that id back).
 */
function randomToolUseId(): string {
  return `gmf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Converts the full provider-agnostic message history to Gemini's `contents`
 * shape as a whole-array pass, not per-message: a ToolResultBlock only
 * carries `toolUseId` (see runtime.ts), but Gemini's functionResponse needs
 * the ORIGINAL function name, resolved here by scanning back through prior
 * assistant turns for the matching ToolUseBlock id.
 */
function toGeminiContents(messages: ProviderMessage[]): GeminiContentEntry[] {
  const nameById = new Map<string, string>();
  for (const m of messages) {
    for (const block of m.content) {
      if (block.type === 'tool_use') nameById.set(block.id, block.name);
    }
  }

  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: m.content.map((block): GeminiPart => {
      if (block.type === 'text') return { text: block.text };
      if (block.type === 'tool_use') {
        return {
          functionCall: { name: block.name, args: block.input },
          thoughtSignature: block.providerMetadata as string | undefined,
        };
      }
      if (block.type === 'image') return { inlineData: { mimeType: block.mediaType, data: block.data } };
      if (block.type === 'document') {
        // Gemini's native document understanding — same inline-base64 path
        // as an image, just a different mimeType. See docs/ai/CAS-AI-PHASE-4.md.
        return { inlineData: { mimeType: block.mediaType, data: block.data } };
      }
      // tool_result
      const name = nameById.get(block.toolUseId) ?? 'unknown_tool';
      return {
        functionResponse: {
          name,
          response: block.isError ? { error: block.content } : { result: block.content },
        },
      };
    }),
  }));
}

function fromGeminiParts(parts: GeminiPart[] | undefined): ContentBlock[] {
  if (!parts) return [];
  const result: ContentBlock[] = [];
  for (const part of parts) {
    if (typeof part.text === 'string') {
      result.push({ type: 'text', text: part.text });
    } else if (part.functionCall) {
      result.push({
        type: 'tool_use',
        id: randomToolUseId(),
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
        providerMetadata: part.thoughtSignature,
      });
    }
    // Other Gemini part shapes (inline audio/image in a model turn, etc.) are
    // not part of Phase 2's provider-agnostic contract — silently dropped,
    // same discipline as AnthropicProvider's fromAnthropicContent.
  }
  return result;
}

function toGeminiTools(tools: ToolSchema[]): Array<{ functionDeclarations: unknown[] }> {
  if (tools.length === 0) return [];
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      })),
    },
  ];
}

/**
 * The only file that talks to the Gemini API. Everything else (runtime.ts,
 * router.ts) depends on the AiProvider interface in ./types, so this provider
 * can be selected via AI_PROVIDER=gemini with zero changes to tool-dispatch
 * or security logic — see ./anthropic.ts for the original of this pattern.
 * Plain `fetch` against the REST API, no SDK dependency — same rationale as
 * the OpenAI voice providers (one well-documented endpoint).
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async sendMessage(request: ProviderRequest, opts: SendMessageOptions): Promise<ProviderResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

    const body: Record<string, unknown> = {
      system_instruction: { parts: [{ text: request.system }] },
      contents: toGeminiContents(request.messages),
      generationConfig: { maxOutputTokens: request.maxTokens },
    };
    const tools = toGeminiTools(request.tools);
    if (tools.length > 0) body.tools = tools;

    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new ProviderTimeoutError();
      if (err instanceof ProviderError) throw err;
      throw new ProviderInvalidResponseError('Failed to reach the AI provider.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new ProviderInvalidResponseError(`AI provider request failed (HTTP ${res.status}).`);
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new ProviderInvalidResponseError();
    }

    const candidate = json?.candidates?.[0];
    if (!candidate) {
      // No candidate is Gemini's shape for a safety-blocked prompt/response —
      // a normal (if unhelpful) invalid-response outcome, never a crash.
      throw new ProviderInvalidResponseError('AI provider returned no response candidate.');
    }

    const content = fromGeminiParts(candidate.content?.parts);
    const hasToolUse = content.some((b) => b.type === 'tool_use');
    // Gemini sets finishReason="STOP" even on a turn that made a function
    // call (unlike Anthropic's explicit stop_reason="tool_use") — the tool
    // loop in runtime.ts branches on stopReason==='tool_use', so this override
    // is required for the loop to ever dispatch a tool at all.
    const stopReason: ProviderStopReason = hasToolUse
      ? 'tool_use'
      : FINISH_REASON_MAP[candidate.finishReason] ?? 'other';

    return {
      content,
      stopReason,
      usage: json.usageMetadata
        ? {
            inputTokens: json.usageMetadata.promptTokenCount ?? 0,
            outputTokens: json.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }
}

let cached: { provider: GeminiProvider; key: string; model: string } | null = null;

/** Lazily constructed at request time, never at module-evaluation time —
 *  same discipline as every other provider in this codebase. */
export function getGeminiProvider(): GeminiProvider {
  const apiKey = process.env.GOOGLE_AI_API_KEY || '';
  const model = process.env.AI_MODEL || DEFAULT_GEMINI_MODEL;
  if (!apiKey) {
    throw new ProviderConfigError('GOOGLE_AI_API_KEY is not configured on the server.');
  }
  if (cached && cached.key === apiKey && cached.model === model) return cached.provider;
  cached = { provider: new GeminiProvider(apiKey, model), key: apiKey, model };
  return cached.provider;
}
