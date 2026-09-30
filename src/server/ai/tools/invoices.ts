import type { ToolDefinition, ArgValidationResult } from '../types.js';
import { asRecord, optionalDate, optionalEnum, optionalUuid, requireUuid } from '../validation.js';
import { parsePagination } from '../pagination.js';

const INVOICE_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'posted', 'reversed'] as const;

interface GetInvoicesArgs {
  projectId?: string;
  customerId?: string;
  status?: (typeof INVOICE_STATUSES)[number];
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
}

export const getInvoices: ToolDefinition<GetInvoicesArgs, unknown[]> = {
  name: 'get_invoices',
  description: 'Lists client invoices/IPCs, optionally filtered by project, customer, status, or date range. RLS-scoped to projects the caller can access.',
  requiredPermission: 'invoices.view',
  validateArgs(raw: unknown): ArgValidationResult<GetInvoicesArgs> {
    const r = asRecord(raw);
    const projectId = optionalUuid(r.projectId, 'projectId');
    if (projectId.ok === false) return projectId;
    const customerId = optionalUuid(r.customerId, 'customerId');
    if (customerId.ok === false) return customerId;
    const status = optionalEnum(r.status, 'status', INVOICE_STATUSES);
    if (status.ok === false) return status;
    const fromDate = optionalDate(r.fromDate, 'fromDate');
    if (fromDate.ok === false) return fromDate;
    const toDate = optionalDate(r.toDate, 'toDate');
    if (toDate.ok === false) return toDate;
    return {
      ok: true,
      args: {
        projectId: projectId.value,
        customerId: customerId.value,
        status: status.value,
        fromDate: fromDate.value,
        toDate: toDate.value,
        ...parsePagination(r),
      },
    };
  },
  async handler(ctx, args) {
    let query = ctx.db
      .from('client_invoices')
      .select('id,invoice_type,invoice_number,date,customer_id,project_id,amount,received_amount,outstanding_amount,status')
      .order('date', { ascending: false })
      .range(args.offset, args.offset + args.limit - 1);
    if (args.projectId) query = query.eq('project_id', args.projectId);
    if (args.customerId) query = query.eq('customer_id', args.customerId);
    if (args.status) query = query.eq('status', args.status);
    if (args.fromDate) query = query.gte('date', args.fromDate);
    if (args.toDate) query = query.lte('date', args.toDate);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load invoices.' };
    return { success: true, data: data ?? [], metadata: { count: data?.length ?? 0, limit: args.limit, offset: args.offset } };
  },
};

interface GetInvoiceDetailsArgs {
  invoiceId: string;
}

export const getInvoiceDetails: ToolDefinition<GetInvoiceDetailsArgs, unknown> = {
  name: 'get_invoice_details',
  description: 'Returns one client invoice/IPC in full, including VAT fields.',
  requiredPermission: 'invoices.view',
  validateArgs(raw: unknown): ArgValidationResult<GetInvoiceDetailsArgs> {
    const r = asRecord(raw);
    const invoiceId = requireUuid(r.invoiceId, 'invoiceId');
    if (invoiceId.ok === false) return invoiceId;
    return { ok: true, args: { invoiceId: invoiceId.value } };
  },
  async handler(ctx, args) {
    const { data, error } = await ctx.db.from('client_invoices').select('*').eq('id', args.invoiceId).maybeSingle();
    if (error) return { success: false, error: 'Failed to load invoice.' };
    if (!data) return { success: false, error: 'Invoice not found or not accessible.' };
    return { success: true, data };
  },
};
