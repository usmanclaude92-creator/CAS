import type { ToolSchema } from './providers/types';
import { ACTION_TOOL_REGISTRY } from './actionRegistry';

/**
 * JSON-Schema descriptions of each ACTION tool's arguments, for advertising
 * to the model only — mirrors toolSchemas.ts's own disclaimer exactly: this
 * is NOT a security boundary. The authoritative validation is each action
 * tool's own `validateArgs` (src/server/ai/actions/tools/*.ts), run
 * unconditionally on every call. Kept in its own file/map, not merged into
 * toolSchemas.ts, for the same reason actionRegistry.ts is a separate
 * registry from registry.ts.
 */
const uuidProp = { type: 'string', description: 'A CAS record UUID.' } as const;
const dateProp = { type: 'string', description: 'ISO date, YYYY-MM-DD.' } as const;

export const ACTION_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  create_reminder: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short reminder title, max 150 characters.' },
      message: { type: 'string', description: 'Reminder body text, max 1000 characters.' },
    },
    required: ['title', 'message'],
  },

  update_vendor_contact_info: {
    type: 'object',
    properties: {
      vendorId: uuidProp,
      contactPerson: { type: 'string', description: 'New contact person name.' },
      phone: { type: 'string' },
      email: { type: 'string' },
      address: { type: 'string' },
      remarks: { type: 'string' },
    },
    required: ['vendorId'],
  },

  create_direct_expense: {
    type: 'object',
    properties: {
      expenseDate: dateProp,
      projectId: uuidProp,
      expenseHeadId: uuidProp,
      description: { type: 'string', description: 'What the expense was for, max 500 characters.' },
      amount: { type: 'number', description: 'Positive amount in OMR, at most 3 decimal places. No VAT — net amount only.' },
      paidFrom: { type: 'string', enum: ['bank', 'cash', 'petty_cash'] },
      accountId: { type: 'string', description: 'UUID of the bank/cash/petty-cash account matching paidFrom.' },
      documentRef: { type: 'string', description: 'Optional document reference; auto-generated if omitted.' },
      remarks: { type: 'string' },
    },
    required: ['expenseDate', 'projectId', 'expenseHeadId', 'description', 'amount', 'paidFrom', 'accountId'],
  },
};

export function actionToolSchemaFor(name: string): Record<string, unknown> {
  return ACTION_TOOL_SCHEMAS[name] ?? { type: 'object', properties: {} };
}

export function toProviderActionToolSchema(name: string, description: string): ToolSchema {
  return { name, description, inputSchema: actionToolSchemaFor(name) };
}

/** Parity check surface, mirrored by actionToolSchemas.test.ts — every
 *  registered action tool must have a hand-written schema entry above. */
export function registeredActionToolNames(): string[] {
  return Object.keys(ACTION_TOOL_REGISTRY);
}
