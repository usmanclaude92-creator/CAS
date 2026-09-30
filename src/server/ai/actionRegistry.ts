import { callerHasPermission, type CallerContext } from '../authContext.js';
import type { ActionToolDefinition, ActionToolDescriptor } from './actions/types.js';
import { createReminderTool } from './actions/tools/reminders.js';
import { updateVendorContactInfoTool } from './actions/tools/vendors.js';
import { createDirectExpenseTool } from './actions/tools/expenses.js';

/**
 * The ACTION tool registry — deliberately a SEPARATE object from
 * ./registry.ts's TOOL_REGISTRY (Phase 5 directive §4: "Extend the existing
 * tool registry with a SEPARATE class of tools"). Kept apart rather than
 * merged so registry.ts's own "contains no write-shaped tool names" guard
 * test (registry.test.ts) continues to hold with zero modification — the
 * read registry is, and remains, read-only by construction; every write-
 * shaped tool lives here instead, gated by its own, opposite guard test
 * (actionRegistry.test.ts).
 */
export const ACTION_TOOL_REGISTRY: Record<string, ActionToolDefinition> = Object.fromEntries(
  [createReminderTool, updateVendorContactInfoTool, createDirectExpenseTool].map((tool) => [tool.name, tool])
);

export function getActionTool(name: string): ActionToolDefinition | undefined {
  return ACTION_TOOL_REGISTRY[name];
}

/** Same "absent, not listed-then-refused" discipline as
 *  registry.ts's listToolsForCaller() — a caller who lacks a tool's
 *  requiredPermission never sees that the tool exists at all. */
export function listActionToolsForCaller(caller: CallerContext): ActionToolDescriptor[] {
  return Object.values(ACTION_TOOL_REGISTRY)
    .filter((tool) => callerHasPermission(caller, tool.requiredPermission))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      requiredPermission: tool.requiredPermission,
      category: tool.category,
      riskLevel: tool.riskLevel,
      requiresConfirmation: tool.requiresConfirmation,
    }));
}
