import type { ToolSchema } from './providers/types.js';
import { TOOL_REGISTRY } from './registry.js';

/**
 * JSON-Schema descriptions of each tool's arguments, for advertising to the
 * LLM only. This is NOT a security boundary — it exists purely so the model
 * knows what shape of input to produce. The actual, authoritative
 * validation is each tool's own `validateArgs` in src/server/ai/tools/*.ts,
 * run unconditionally on every call regardless of what the model sends (see
 * runtime.ts). A registry.test.ts-style parity test asserts every entry in
 * TOOL_REGISTRY has a matching entry here, so a newly added Phase-3+ tool
 * can't silently go un-advertised.
 */
const uuidProp = { type: 'string', description: 'A CAS record UUID.' } as const;
const searchProp = { type: 'string', description: 'Free-text name search (partial match).' } as const;
const dateProp = { type: 'string', description: 'ISO date, YYYY-MM-DD.' } as const;
const limitProp = { type: 'number', description: 'Max rows to return (default 20, max 100).' } as const;
const offsetProp = { type: 'number', description: 'Pagination offset (default 0).' } as const;

const pagingProps = { limit: limitProp, offset: offsetProp };

const INVOICE_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'posted', 'reversed'];

export const TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_projects: { type: 'object', properties: { search: searchProp, status: { type: 'string' }, ...pagingProps } },
  get_project_summary: { type: 'object', properties: { projectId: uuidProp }, required: ['projectId'] },

  get_clients: { type: 'object', properties: { search: searchProp, ...pagingProps } },
  get_client_details: { type: 'object', properties: { clientId: uuidProp, clientName: { type: 'string' } } },
  get_client_balance: { type: 'object', properties: { clientId: uuidProp, clientName: { type: 'string' } } },

  get_vendors: { type: 'object', properties: { search: searchProp, ...pagingProps } },
  get_vendor_details: { type: 'object', properties: { vendorId: uuidProp, vendorName: { type: 'string' } } },
  get_vendor_balance: { type: 'object', properties: { vendorId: uuidProp, vendorName: { type: 'string' } } },

  get_invoices: {
    type: 'object',
    properties: {
      projectId: uuidProp,
      customerId: uuidProp,
      status: { type: 'string', enum: INVOICE_STATUSES },
      fromDate: dateProp,
      toDate: dateProp,
      ...pagingProps,
    },
  },
  get_invoice_details: { type: 'object', properties: { invoiceId: uuidProp }, required: ['invoiceId'] },

  get_receivables: { type: 'object', properties: { projectId: uuidProp } },
  get_payables: { type: 'object', properties: { projectId: uuidProp } },
  get_receipts: { type: 'object', properties: { projectId: uuidProp, fromDate: dateProp, toDate: dateProp, ...pagingProps } },
  get_vendor_payments: { type: 'object', properties: { projectId: uuidProp, fromDate: dateProp, toDate: dateProp, ...pagingProps } },
  get_expenses: {
    type: 'object',
    properties: { projectId: uuidProp, expenseHeadId: uuidProp, fromDate: dateProp, toDate: dateProp, ...pagingProps },
  },

  get_bank_accounts: { type: 'object', properties: {} },
  get_bank_transactions: { type: 'object', properties: { accountId: uuidProp }, required: ['accountId'] },
  get_cash_position: { type: 'object', properties: {} },
};

export function toolSchemaFor(name: string): Record<string, unknown> {
  // A generic, permissive fallback (rather than throwing) for any tool
  // missing a hand-written entry above — validateArgs still rejects a
  // malformed call regardless, so this is a UX gap, never a security one.
  return TOOL_SCHEMAS[name] ?? { type: 'object', properties: {} };
}

export function toProviderToolSchema(name: string, description: string): ToolSchema {
  return { name, description, inputSchema: toolSchemaFor(name) };
}

/** Every registered tool must have a hand-written schema entry — checked in
 *  toolSchemas.test.ts, not just relying on the generic fallback above. */
export function registeredToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}
