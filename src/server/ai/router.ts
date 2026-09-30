import express from 'express';
import { getCallerContext, callerHasPermission, log } from '../authContext.js';
import { getTool, listToolsForCaller } from './registry.js';
import { createCallerScopedClient } from './db.js';
import { recordAiToolCall } from './audit.js';
import { getConversation, listRecentMessages } from './conversations.js';
import { runAiChat, MAX_USER_MESSAGE_LENGTH } from './runtime.js';
import type { ToolResult } from './types.js';

export const aiRouter = express.Router();

/**
 * GET /api/ai/tools — lists only the tools the authenticated caller
 * currently has permission to use. A tool the caller can't use is simply
 * absent, not listed-then-refused — matches docs/ai/CAS-AI-DATA-FLOW.md.
 */
aiRouter.get('/tools', async (req, res) => {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }
  return res.status(200).json({ success: true, tools: listToolsForCaller(caller) });
});

const RUN_CHAT_ERROR_STATUS: Record<string, number> = {
  invalid_request: 400,
  conversation_not_found: 404,
  provider_config: 503,
  provider_timeout: 504,
  provider_failure: 502,
  internal_error: 500,
};

/**
 * POST /api/ai/chat — dual contract, both auth-gated identically:
 *
 * 1. Phase 1 (unchanged): { "tool": "<registered tool name>", "arguments": {...} }
 *    Direct, single tool dispatch with no LLM involved — exactly as a
 *    future model's tool-use turn would call a tool. Kept as-is so nothing
 *    depending on this contract (including router.test.ts) breaks.
 *
 * 2. Phase 2 (new): { "message": "<user text>", "conversationId"?: "<uuid>" }
 *    Runs the real AI runtime (src/server/ai/runtime.ts): loads/creates the
 *    conversation, calls the configured LLM provider with only the tools
 *    this caller holds permission for, dispatches any tool_use turns
 *    through the exact same tool registry/permission/validation path as
 *    contract 1, and returns the model's final natural-language reply.
 *
 * Neither path ever accepts SQL, a table name, or a column name from the
 * request — only a registered tool name (contract 1) or free-text chat
 * content that can only ever reach the database through that same tool
 * registry (contract 2).
 */
aiRouter.post('/chat', async (req, res) => {
  const startedAt = Date.now();

  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  if (typeof body.message === 'string') {
    if (body.message.length > MAX_USER_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, error: `Message exceeds the ${MAX_USER_MESSAGE_LENGTH}-character limit.` });
    }
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined;

    let db;
    try {
      // See the try/catch below the legacy path for why this is inside,
      // not before, the try (createCallerScopedClient can throw synchronously).
      db = createCallerScopedClient(caller.jwt);
    } catch (err: any) {
      log('error', '[AI Gateway] failed to create caller-scoped client', { error: err?.message });
      return res.status(500).json({ success: false, error: 'Internal server error.' });
    }

    let result;
    try {
      result = await runAiChat({ caller, db, conversationId, message: body.message });
    } catch (err: any) {
      log('error', '[AI Gateway] runAiChat threw', { error: err?.message });
      return res.status(500).json({ success: false, error: 'Internal error processing your request.' });
    }

    if (result.success === false) {
      return res.status(RUN_CHAT_ERROR_STATUS[result.category] ?? 500).json({ success: false, error: result.error });
    }
    return res.status(200).json({
      success: true,
      conversationId: result.conversationId,
      reply: result.reply,
      toolActivity: result.toolActivity,
    });
  }

  const toolName = typeof body.tool === 'string' ? body.tool : undefined;
  if (!toolName) {
    return res.status(400).json({ success: false, error: 'Request body must include either "tool" (direct tool call) or "message" (chat).' });
  }

  const tool = getTool(toolName);
  if (!tool) {
    return res.status(400).json({ success: false, error: `Unknown tool "${toolName}".` });
  }

  if (!callerHasPermission(caller, tool.requiredPermission)) {
    return res.status(403).json({ success: false, error: `Forbidden: missing required permission "${tool.requiredPermission}".` });
  }

  const validated = tool.validateArgs(body.arguments);
  if (validated.ok === false) {
    return res.status(400).json({ success: false, error: validated.error });
  }

  let result: ToolResult<unknown>;
  try {
    // createCallerScopedClient() itself throws synchronously if
    // SUPABASE_URL/ANON_KEY are misconfigured — kept inside this try, not
    // before it, so a deployment misconfiguration can never crash the
    // request handler uncaught (an async Express 4 route handler does not
    // automatically catch a synchronous throw).
    const db = createCallerScopedClient(caller.jwt);
    result = await tool.handler({ caller, db }, validated.args);
  } catch (err: any) {
    // Never leak the underlying error (stack trace, SQL, etc.) to the caller.
    log('error', '[AI Gateway] tool handler threw', { tool: toolName, error: err?.message });
    result = { success: false, error: 'Internal error executing tool.' };
  }

  // Best-effort, never blocks the response (see src/server/ai/audit.ts).
  const errorMessage = result.success === false ? result.error : undefined;
  void recordAiToolCall({
    caller,
    toolName,
    argumentsSummary: validated.args as Record<string, unknown>,
    success: result.success,
    errorMessage,
    durationMs: Date.now() - startedAt,
  });

  // Uniform 200 with a { success, data|error } body for every request that
  // reached tool execution — auth/validation failures above already used
  // 401/400/403. A tool-level "no matching record" is a normal answer to a
  // well-formed, authorized request, not a transport-level error.
  return res.status(200).json(result);
});

/**
 * GET /api/ai/conversations/:id/messages — lets the chat UI restore a
 * conversation's history (e.g. after a page reload). RLS on ai_messages, via
 * ai_conversations' own ownership policy, means a caller can never fetch
 * another user's conversation by guessing/changing the id: getConversation
 * returns null for both "doesn't exist" and "not yours," and both are
 * reported identically below — never confirm another user's conversation exists.
 */
aiRouter.get('/conversations/:id/messages', async (req, res) => {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[AI Gateway] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const conversation = await getConversation(db, req.params.id);
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found.' });
  }

  const messages = await listRecentMessages(db, conversation.id);
  return res.status(200).json({
    success: true,
    conversationId: conversation.id,
    messages: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.created_at })),
  });
});
