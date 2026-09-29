import { callerHasPermission, type CallerContext } from '../authContext';
import type { ToolDefinition, ToolDescriptor } from './types';

import { getProjects, getProjectSummary } from './tools/projects';
import { getClients, getClientDetails, getClientBalance } from './tools/customers';
import { getVendors, getVendorDetails, getVendorBalance } from './tools/vendors';
import { getInvoices, getInvoiceDetails } from './tools/invoices';
import { getReceivables, getPayables, getReceipts, getVendorPayments, getExpenses } from './tools/financial';
import { getBankAccounts, getBankTransactions, getCashPosition } from './tools/treasury';
import { searchKnowledgeTool } from './tools/knowledge';

/**
 * The ONLY way AI tool data can be reached — no raw SQL, no table/column
 * names accepted from a request, no service_role. See
 * docs/ai/CAS-AI-TOOL-REGISTRY.md for the per-tool design rationale
 * (including why a few tools suggested in Phase 0/1 planning — get_contracts,
 * get_contract_variations, get_suppliers — are absent: no such tables/terms
 * exist in this schema).
 */
export const TOOL_REGISTRY: Record<string, ToolDefinition> = Object.fromEntries(
  [
    getProjects,
    getProjectSummary,
    getClients,
    getClientDetails,
    getClientBalance,
    getVendors,
    getVendorDetails,
    getVendorBalance,
    getInvoices,
    getInvoiceDetails,
    getReceivables,
    getPayables,
    getReceipts,
    getVendorPayments,
    getExpenses,
    getBankAccounts,
    getBankTransactions,
    getCashPosition,
    searchKnowledgeTool,
  ].map((tool) => [tool.name, tool])
);

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[name];
}

/** Tools a specific caller currently has permission to use — this is what
 *  GET /api/ai/tools returns, and (later) what a model would be offered.
 *  A tool the caller can't use isn't listed, rather than listed-then-refused. */
export function listToolsForCaller(caller: CallerContext): ToolDescriptor[] {
  return Object.values(TOOL_REGISTRY)
    .filter((tool) => callerHasPermission(caller, tool.requiredPermission))
    .map((tool) => ({ name: tool.name, description: tool.description, requiredPermission: tool.requiredPermission }));
}
