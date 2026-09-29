import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallerContext } from '../authContext';
import { callerHasPermission, log } from '../authContext';
import { getTool, listToolsForCaller } from './registry';
import { recordAiToolCall } from './audit';
import { buildSystemPrompt } from './systemPrompt';
import { toProviderToolSchema } from './toolSchemas';
import { toolActivityLabel } from './toolActivityLabels';
import {
  createConversation,
  getConversation,
  listRecentMessages,
  appendMessage,
  touchConversation,
  MAX_CONTEXT_MESSAGES,
} from './conversations';
import { getProvider, getConfiguredModelName, ProviderError, ProviderConfigError, ProviderTimeoutError } from './providers';
import type { ProviderMessage, ContentBlock, ToolUseBlock } from './providers/types';
import type { ToolResult } from './types';

/**
 * Loop/limit constants — see docs/ai/CAS-AI-PHASE-2.md §Limits. Every one of
 * these exists to stop a single request from calling tools indefinitely,
 * blowing the model's context, or running unbounded — never tuned for
 * "typical" behavior, only for the worst case (a runaway or adversarial
 * model response).
 */
export const MAX_USER_MESSAGE_LENGTH = 4000;
export const MAX_TOOL_CALLS_PER_REQUEST = 8;
export const MAX_MODEL_TURNS = 6;
export const PROVIDER_TIMEOUT_MS = 30_000;
export const TOOL_EXECUTION_TIMEOUT_MS = 15_000;
export const MAX_TOTAL_RUNTIME_MS = 60_000;
export const MAX_TOOL_RESULT_CHARS = 6_000;
export const RESPONSE_MAX_TOKENS = 1_024;

export interface RunChatInput {
  caller: CallerContext;
  db: SupabaseClient;
  conversationId?: string;
  message: string;
}

export type RunChatErrorCategory =
  | 'invalid_request'
  | 'conversation_not_found'
  | 'provider_config'
  | 'provider_timeout'
  | 'provider_failure'
  | 'internal_error';

export interface ToolActivityEntry {
  label: string;
}

export type RunChatResult =
  | { success: true; conversationId: string; reply: string; toolActivity: ToolActivityEntry[] }
  | { success: false; category: RunChatErrorCategory; error: string };

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Every tool the model requests — whether it was actually offered that tool
 * or not — goes through the exact same gate as POST /api/ai/chat's direct
 * {tool,arguments} path in router.ts: permission check, then validateArgs,
 * then execution, then audit. The model is untrusted input; nothing about
 * being "inside the AI runtime" grants a tool call any more trust than a
 * request straight from the wire would get.
 */
async function executeToolCall(
  caller: CallerContext,
  db: SupabaseClient,
  block: ToolUseBlock,
  conversationId: string
): Promise<ToolResult<unknown>> {
  const startedAt = Date.now();
  const record = (toolName: string, success: boolean, errorMessage: string | undefined, argsSummary: Record<string, unknown>) => {
    void recordAiToolCall({
      caller,
      toolName,
      argumentsSummary: argsSummary,
      success,
      errorMessage,
      durationMs: Date.now() - startedAt,
      conversationId,
    });
  };

  const tool = getTool(block.name);
  if (!tool) {
    const error = `Unknown tool "${block.name}".`;
    record(block.name, false, error, {});
    return { success: false, error };
  }

  if (!callerHasPermission(caller, tool.requiredPermission)) {
    // The model was only ever offered tools this caller holds permission
    // for (listToolsForCaller). A request for anything else — a
    // hallucinated name, or an attempted escalation via prompt-injected
    // database content — is rejected here exactly as router.ts would
    // reject it over the wire, and recorded as a security-relevant event.
    const error = 'Forbidden: missing required permission for this tool.';
    log('warn', '[AI runtime] model requested an unauthorized tool', { tool: block.name, userId: caller.userId });
    record(tool.name, false, error, {});
    return { success: false, error };
  }

  const validated = tool.validateArgs(block.input);
  if (validated.ok === false) {
    record(tool.name, false, validated.error, {});
    return { success: false, error: validated.error };
  }

  let result: ToolResult<unknown>;
  try {
    result = await withTimeout(
      tool.handler({ caller, db }, validated.args),
      TOOL_EXECUTION_TIMEOUT_MS,
      'Tool execution timed out.'
    );
  } catch (err: any) {
    log('error', '[AI runtime] tool handler threw or timed out', { tool: tool.name, error: err?.message });
    result = { success: false, error: 'Internal error executing tool.' };
  }

  record(tool.name, result.success, result.success === false ? result.error : undefined, validated.args as Record<string, unknown>);
  return result;
}

function boundToolResultJson(result: ToolResult<unknown>): string {
  const json = JSON.stringify(result);
  if (json.length <= MAX_TOOL_RESULT_CHARS) return json;
  // An oversized tool result must never reach the model whole — bound it
  // and say so, rather than silently dropping rows or exceeding context.
  return JSON.stringify({
    success: result.success,
    truncated: true,
    note: `Result exceeded ${MAX_TOOL_RESULT_CHARS} characters and was truncated. Ask a more specific question (narrower date range, single project, etc.) to see the rest.`,
    preview: json.slice(0, MAX_TOOL_RESULT_CHARS),
  });
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n');
}

/**
 * The AI runtime: authenticated chat request -> conversation context ->
 * system instructions -> caller-scoped tool list -> provider call -> tool
 * dispatch loop (bounded) -> final text -> persistence + audit. See
 * docs/ai/CAS-AI-PHASE-2.md for the full request lifecycle this implements.
 */
export async function runAiChat(input: RunChatInput): Promise<RunChatResult> {
  const message = input.message?.trim() ?? '';
  if (!message) {
    return { success: false, category: 'invalid_request', error: 'Message must not be empty.' };
  }
  if (message.length > MAX_USER_MESSAGE_LENGTH) {
    return {
      success: false,
      category: 'invalid_request',
      error: `Message exceeds the ${MAX_USER_MESSAGE_LENGTH}-character limit.`,
    };
  }

  const conversation = input.conversationId
    ? await getConversation(input.db, input.conversationId)
    : await createConversation(input.db, input.caller.userId, message.slice(0, 80));

  if (!conversation) {
    // Both "doesn't exist" and "belongs to another user" land here — RLS
    // makes those indistinguishable, which is correct: never confirm that
    // a conversation exists before ownership is established.
    return {
      success: false,
      category: input.conversationId ? 'conversation_not_found' : 'internal_error',
      error: input.conversationId ? 'Conversation not found.' : 'Failed to start a new conversation.',
    };
  }

  await appendMessage(input.db, conversation.id, 'user', message);

  let provider;
  try {
    provider = getProvider();
  } catch (err) {
    if (err instanceof ProviderConfigError) {
      log('error', '[AI runtime] provider not configured', { error: err.message });
      return {
        success: false,
        category: 'provider_config',
        error: 'The AI Agent is not currently configured. Please contact your administrator.',
      };
    }
    return { success: false, category: 'internal_error', error: 'Failed to initialize the AI provider.' };
  }

  const availableTools = listToolsForCaller(input.caller);
  const system = buildSystemPrompt(availableTools);
  const toolSchemas = availableTools.map((t) => toProviderToolSchema(t.name, t.description));

  const history = await listRecentMessages(input.db, conversation.id, MAX_CONTEXT_MESSAGES);
  const providerMessages: ProviderMessage[] = history.map((m) => ({
    role: m.role,
    content: [{ type: 'text', text: m.content }],
  }));

  const toolActivity: ToolActivityEntry[] = [];
  const deadline = Date.now() + MAX_TOTAL_RUNTIME_MS;
  let toolCallCount = 0;
  let finalText = '';
  let limited = false;
  let endedNaturally = false;

  for (let turn = 1; turn <= MAX_MODEL_TURNS; turn++) {
    if (Date.now() > deadline) {
      limited = true;
      break;
    }

    let response;
    try {
      response = await provider.sendMessage(
        // A snapshot, not the live array: providerMessages keeps growing
        // after this call is issued, and a provider (or a test observing
        // provider.sendMessage's captured arguments) must see exactly the
        // conversation state as of this turn, not a reference that later
        // mutates out from under it.
        { system, messages: [...providerMessages], tools: toolSchemas, maxTokens: RESPONSE_MAX_TOKENS },
        { timeoutMs: PROVIDER_TIMEOUT_MS }
      );
    } catch (err) {
      if (err instanceof ProviderTimeoutError) {
        return { success: false, category: 'provider_timeout', error: 'The AI Agent took too long to respond. Please try again.' };
      }
      if (err instanceof ProviderError) {
        log('error', '[AI runtime] provider request failed', { category: err.category, message: err.message });
        return { success: false, category: 'provider_failure', error: 'The AI Agent is temporarily unavailable. Please try again shortly.' };
      }
      log('error', '[AI runtime] unexpected error calling provider', { error: (err as any)?.message });
      return { success: false, category: 'internal_error', error: 'An unexpected error occurred.' };
    }

    providerMessages.push({ role: 'assistant', content: response.content });

    const text = extractText(response.content);
    if (text) finalText = text;

    const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');

    if (response.stopReason !== 'tool_use' || toolUseBlocks.length === 0) {
      endedNaturally = true;
      break;
    }

    if (toolCallCount + toolUseBlocks.length > MAX_TOOL_CALLS_PER_REQUEST) {
      // The provider API requires a tool_result for every tool_use id in
      // this turn before any further turn — answer them all with a safe
      // "limit reached" error, then stop, rather than leaving the
      // conversation in a shape the next request can't continue from.
      const resultBlocks: ContentBlock[] = toolUseBlocks.map((b) => ({
        type: 'tool_result',
        toolUseId: b.id,
        content: JSON.stringify({ success: false, error: 'Tool call limit reached for this request.' }),
        isError: true,
      }));
      providerMessages.push({ role: 'user', content: resultBlocks });
      limited = true;
      break;
    }

    const resultBlocks: ContentBlock[] = [];
    for (const block of toolUseBlocks) {
      toolCallCount++;
      const result = await executeToolCall(input.caller, input.db, block, conversation.id);
      resultBlocks.push({
        type: 'tool_result',
        toolUseId: block.id,
        content: boundToolResultJson(result),
        isError: result.success === false,
      });
      toolActivity.push({ label: toolActivityLabel(block.name) });
    }
    providerMessages.push({ role: 'user', content: resultBlocks });
  }

  // The for-loop can also end by simple exhaustion (MAX_MODEL_TURNS reached
  // while the model was still requesting tool calls) — that is a limit hit
  // exactly as much as the explicit deadline/tool-count breaks above, so it
  // must be reported the same way, not silently treated as "no answer".
  if (!endedNaturally) limited = true;

  if (!finalText) {
    finalText = limited
      ? "I've reached the limit for this request before finishing. Please ask a more specific question, or try again."
      : 'I was unable to produce a response. Please try rephrasing your question.';
  }

  await appendMessage(input.db, conversation.id, 'assistant', finalText, {
    provider: provider.name,
    model: getConfiguredModelName(),
  });
  await touchConversation(input.db, conversation.id);

  return { success: true, conversationId: conversation.id, reply: finalText, toolActivity };
}
