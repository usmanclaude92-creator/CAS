/**
 * Provider-agnostic LLM abstraction. src/server/ai/runtime.ts talks only to
 * this interface — never to an SDK client directly — so a second provider
 * (OpenAI, etc.) can be added later as another file implementing AiProvider,
 * with zero changes to the runtime, tool dispatch, or security logic.
 */

export interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments (Anthropic's `input_schema` shape,
   *  generic enough for any provider that does JSON-Schema tool calling). */
  inputSchema: Record<string, unknown>;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
  /**
   * Opaque, provider-specific round-trip data a provider needs replayed
   * verbatim on this same block's next turn — runtime.ts never reads or
   * interprets this, it only carries it through the in-memory tool loop
   * (never persisted to the DB; conversation history stores final text
   * only). Gemini's "thinking" models use this for their required
   * thought_signature (a missing one is a hard 400, not a soft
   * degradation) — see providers/gemini.ts. Unused by Anthropic.
   */
  providerMetadata?: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  /** Always a bounded, JSON-stringified summary — never a raw object graph. */
  content: string;
  isError?: boolean;
}

/**
 * Phase 4 multimodal input — a user-uploaded image, already validated
 * server-side (size/MIME/magic-bytes, see src/server/ai/attachments.ts)
 * before it ever reaches this type. Sent only in the user turn that
 * referenced it; never persisted as binary (src/server/ai/conversations.ts
 * stores text only).
 */
export interface ImageBlock {
  type: 'image';
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string; // base64
}

/** Phase 4 multimodal input — a user-uploaded PDF, passed to the model
 *  natively (Claude has first-party PDF understanding) rather than through
 *  a separate text-extraction library. */
export interface DocumentBlock {
  type: 'document';
  mediaType: 'application/pdf';
  data: string; // base64
  title?: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock | DocumentBlock;

export type ConversationRole = 'user' | 'assistant';

export interface ProviderMessage {
  role: ConversationRole;
  content: ContentBlock[];
}

export interface ProviderRequest {
  system: string;
  messages: ProviderMessage[];
  tools: ToolSchema[];
  maxTokens: number;
}

export type ProviderStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'other';

export interface ProviderResponse {
  content: ContentBlock[];
  stopReason: ProviderStopReason;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface SendMessageOptions {
  timeoutMs: number;
}

export interface AiProvider {
  readonly name: string;
  sendMessage(request: ProviderRequest, opts: SendMessageOptions): Promise<ProviderResponse>;
}
