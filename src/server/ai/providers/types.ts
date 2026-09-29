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
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  /** Always a bounded, JSON-stringified summary — never a raw object graph. */
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

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
