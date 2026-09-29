import express from 'express';
import { getCallerContext, callerHasPermission, log } from '../authContext';
import { getTool, listToolsForCaller } from './registry';
import { createCallerScopedClient } from './db';
import { recordAiToolCall } from './audit';
import type { ToolResult } from './types';

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

/**
 * POST /api/ai/chat — Phase 1 gateway/test endpoint. Despite the name, this
 * does NOT call an LLM (see docs/ai/CAS-AI-PHASE-1.md §Known limitations) —
 * it accepts a single structured tool call, exactly as a future model's
 * tool-use turn would, so the tool layer can be built and tested completely
 * independently of any provider integration.
 *
 * Body: { "tool": "<registered tool name>", "arguments": { ... } }
 *
 * There is no other way to reach a tool's data: no field on this body is
 * ever interpreted as SQL, a table name, or a column name — only the fixed
 * `tool` name (looked up in the registry) and the tool's own typed,
 * validated `arguments`.
 */
aiRouter.post('/chat', async (req, res) => {
  const startedAt = Date.now();

  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const toolName = typeof body.tool === 'string' ? body.tool : undefined;
  if (!toolName) {
    return res.status(400).json({ success: false, error: 'Request body must include a "tool" name.' });
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
