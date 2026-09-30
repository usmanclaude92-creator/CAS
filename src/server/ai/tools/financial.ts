import { addMoney } from '../../../utils/formatters.js';
import type { ToolDefinition, ArgValidationResult } from '../types.js';
import { asRecord, optionalDate, optionalUuid } from '../validation.js';
import { parsePagination } from '../pagination.js';

const AGGREGATE_ROW_CAP = 2000;

interface GetReceivablesArgs {
  projectId?: string;
}

export const getReceivables: ToolDefinition<GetReceivablesArgs, unknown> = {
  name: 'get_receivables',
  description: 'Total outstanding client receivables (SUM(outstanding_amount) over posted client_invoices), optionally scoped to one project.',
  requiredPermission: 'invoices.view',
  validateArgs(raw: unknown): ArgValidationResult<GetReceivablesArgs> {
    const r = asRecord(raw);
    const projectId = optionalUuid(r.projectId, 'projectId');
    if (projectId.ok === false) return projectId;
    return { ok: true, args: { projectId: projectId.value } };
  },
  async handler(ctx, args) {
    let query = ctx.db.from('client_invoices').select('outstanding_amount').eq('status', 'posted').limit(AGGREGATE_ROW_CAP);
    if (args.projectId) query = query.eq('project_id', args.projectId);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load receivables.' };
    return {
      success: true,
      data: { totalOutstanding: addMoney(...(data ?? []).map((r) => r.outstanding_amount)) },
      metadata: { basis: 'posted client_invoices only', rowsSummed: data?.length ?? 0 },
    };
  },
};

interface GetPayablesArgs {
  projectId?: string;
}

export const getPayables: ToolDefinition<GetPayablesArgs, unknown> = {
  name: 'get_payables',
  description: 'Total outstanding vendor payables (SUM(outstanding_amount) over posted purchases), optionally scoped to one project.',
  requiredPermission: 'purchases.view',
  validateArgs(raw: unknown): ArgValidationResult<GetPayablesArgs> {
    const r = asRecord(raw);
    const projectId = optionalUuid(r.projectId, 'projectId');
    if (projectId.ok === false) return projectId;
    return { ok: true, args: { projectId: projectId.value } };
  },
  async handler(ctx, args) {
    let query = ctx.db.from('purchases').select('outstanding_amount').eq('status', 'posted').limit(AGGREGATE_ROW_CAP);
    if (args.projectId) query = query.eq('project_id', args.projectId);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load payables.' };
    return {
      success: true,
      data: { totalOutstanding: addMoney(...(data ?? []).map((r) => r.outstanding_amount)) },
      metadata: { basis: 'posted purchases only', rowsSummed: data?.length ?? 0 },
    };
  },
};

interface GetPaymentsArgs {
  projectId?: string;
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
}

function validatePaymentsArgs(raw: unknown): ArgValidationResult<GetPaymentsArgs> {
  const r = asRecord(raw);
  const projectId = optionalUuid(r.projectId, 'projectId');
  if (projectId.ok === false) return projectId;
  const fromDate = optionalDate(r.fromDate, 'fromDate');
  if (fromDate.ok === false) return fromDate;
  const toDate = optionalDate(r.toDate, 'toDate');
  if (toDate.ok === false) return toDate;
  return {
    ok: true as const,
    args: { projectId: projectId.value, fromDate: fromDate.value, toDate: toDate.value, ...parsePagination(r) },
  };
}

/**
 * CAS models receipts and vendor payments as two separate tables/permissions
 * (money_in / money_out), each with its own view permission — so this is
 * two tools, not one "get_payments" gated by a caller-suppliable argument.
 * A single tool whose required permission depended on an input field would
 * let a caller with only money_in.view request money_out data by passing
 * direction="out"; a static per-tool permission can't express that, and
 * the fix is two tools, not a dynamic check the registry doesn't support.
 */
export const getReceipts: ToolDefinition<GetPaymentsArgs, unknown[]> = {
  name: 'get_receipts',
  description: 'Lists client receipts (money_in), optionally filtered by project or date range.',
  requiredPermission: 'money_in.view',
  validateArgs: validatePaymentsArgs,
  async handler(ctx, args) {
    let query = ctx.db
      .from('money_in')
      .select('id,transaction_date,received_from,customer_id,project_id,amount,received_into,account_id,status')
      .order('transaction_date', { ascending: false })
      .range(args.offset, args.offset + args.limit - 1);
    if (args.projectId) query = query.eq('project_id', args.projectId);
    if (args.fromDate) query = query.gte('transaction_date', args.fromDate);
    if (args.toDate) query = query.lte('transaction_date', args.toDate);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load receipts.' };
    return { success: true, data: data ?? [], metadata: { count: data?.length ?? 0, limit: args.limit, offset: args.offset } };
  },
};

export const getVendorPayments: ToolDefinition<GetPaymentsArgs, unknown[]> = {
  name: 'get_vendor_payments',
  description: 'Lists vendor payments (money_out), optionally filtered by project or date range.',
  requiredPermission: 'money_out.view',
  validateArgs: validatePaymentsArgs,
  async handler(ctx, args) {
    let query = ctx.db
      .from('money_out')
      .select('id,transaction_date,paid_to,vendor_id,project_id,amount,paid_from,account_id,status')
      .order('transaction_date', { ascending: false })
      .range(args.offset, args.offset + args.limit - 1);
    if (args.projectId) query = query.eq('project_id', args.projectId);
    if (args.fromDate) query = query.gte('transaction_date', args.fromDate);
    if (args.toDate) query = query.lte('transaction_date', args.toDate);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load vendor payments.' };
    return { success: true, data: data ?? [], metadata: { count: data?.length ?? 0, limit: args.limit, offset: args.offset } };
  },
};

interface GetExpensesArgs {
  projectId?: string;
  expenseHeadId?: string;
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
}

export const getExpenses: ToolDefinition<GetExpensesArgs, unknown[]> = {
  name: 'get_expenses',
  description: 'Lists direct site expenses, optionally filtered by project, expense head, or date range.',
  requiredPermission: 'expenses.view',
  validateArgs(raw: unknown): ArgValidationResult<GetExpensesArgs> {
    const r = asRecord(raw);
    const projectId = optionalUuid(r.projectId, 'projectId');
    if (projectId.ok === false) return projectId;
    const expenseHeadId = optionalUuid(r.expenseHeadId, 'expenseHeadId');
    if (expenseHeadId.ok === false) return expenseHeadId;
    const fromDate = optionalDate(r.fromDate, 'fromDate');
    if (fromDate.ok === false) return fromDate;
    const toDate = optionalDate(r.toDate, 'toDate');
    if (toDate.ok === false) return toDate;
    return {
      ok: true,
      args: { projectId: projectId.value, expenseHeadId: expenseHeadId.value, fromDate: fromDate.value, toDate: toDate.value, ...parsePagination(r) },
    };
  },
  async handler(ctx, args) {
    let query = ctx.db
      .from('direct_expenses')
      .select('id,date,project_id,expense_head_id,amount,status')
      .order('date', { ascending: false })
      .range(args.offset, args.offset + args.limit - 1);
    if (args.projectId) query = query.eq('project_id', args.projectId);
    if (args.expenseHeadId) query = query.eq('expense_head_id', args.expenseHeadId);
    if (args.fromDate) query = query.gte('date', args.fromDate);
    if (args.toDate) query = query.lte('date', args.toDate);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load expenses.' };
    return { success: true, data: data ?? [], metadata: { count: data?.length ?? 0, limit: args.limit, offset: args.offset } };
  },
};
