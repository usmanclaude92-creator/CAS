import { addMoney } from '../../../utils/formatters';
import type { ToolDefinition, ArgValidationResult } from '../types';
import { asRecord, optionalString, requireUuid } from '../validation';
import { parsePagination } from '../pagination';

/** Rows beyond this are not summed for get_project_summary — a documented
 *  Phase 1 limitation (see docs/ai/CAS-AI-PHASE-1.md); revisit with a
 *  Postgres-side aggregate if any single project ever exceeds this. */
const SUMMARY_ROW_CAP = 2000;

interface GetProjectsArgs {
  search?: string;
  status?: string;
  limit: number;
  offset: number;
}

export const getProjects: ToolDefinition<GetProjectsArgs, unknown[]> = {
  name: 'get_projects',
  description:
    'Lists projects visible to the caller. Scoped automatically by RLS to projects the caller is assigned to (or all projects if their profile has is_all_projects).',
  requiredPermission: 'projects.view',
  validateArgs(raw: unknown): ArgValidationResult<GetProjectsArgs> {
    const r = asRecord(raw);
    const search = optionalString(r.search, 'search', 200);
    if (search.ok === false) return search;
    const status = optionalString(r.status, 'status', 20);
    if (status.ok === false) return status;
    return { ok: true, args: { search: search.value, status: status.value, ...parsePagination(r) } };
  },
  async handler(ctx, args) {
    let query = ctx.db
      .from('projects')
      .select('id,code,name,customer_id,contract_value,budget_cost,start_date,end_date,status')
      .order('name')
      .range(args.offset, args.offset + args.limit - 1);
    if (args.search) query = query.ilike('name', `%${args.search}%`);
    if (args.status) query = query.eq('status', args.status);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load projects.' };
    return { success: true, data: data ?? [], metadata: { count: data?.length ?? 0, limit: args.limit, offset: args.offset } };
  },
};

interface GetProjectSummaryArgs {
  projectId: string;
}

export const getProjectSummary: ToolDefinition<GetProjectSummaryArgs, unknown> = {
  name: 'get_project_summary',
  description:
    'Returns one project\'s authoritative contract value/budget plus invoiced, receivable-outstanding, cost-incurred and payable-outstanding totals for posted transactions. Financial figures are read from CAS rows and summed with the same decimal-safe helper (addMoney) the rest of the app uses for OMR — never plain JS float addition.',
  requiredPermission: 'projects.view',
  validateArgs(raw: unknown): ArgValidationResult<GetProjectSummaryArgs> {
    const r = asRecord(raw);
    const projectId = requireUuid(r.projectId, 'projectId');
    if (projectId.ok === false) return projectId;
    return { ok: true, args: { projectId: projectId.value } };
  },
  async handler(ctx, args) {
    const { data: project, error: projectError } = await ctx.db
      .from('projects')
      .select('id,code,name,contract_value,budget_cost,status')
      .eq('id', args.projectId)
      .maybeSingle();
    if (projectError) return { success: false, error: 'Failed to load project.' };
    if (!project) return { success: false, error: 'Project not found or not accessible.' };

    const [invoices, purchases, expenses] = await Promise.all([
      ctx.db
        .from('client_invoices')
        .select('amount,outstanding_amount,status')
        .eq('project_id', args.projectId)
        .limit(SUMMARY_ROW_CAP),
      ctx.db
        .from('purchases')
        .select('amount,outstanding_amount,status')
        .eq('project_id', args.projectId)
        .limit(SUMMARY_ROW_CAP),
      ctx.db
        .from('direct_expenses')
        .select('amount,status')
        .eq('project_id', args.projectId)
        .limit(SUMMARY_ROW_CAP),
    ]);
    if (invoices.error || purchases.error || expenses.error) {
      return { success: false, error: 'Failed to load project financials.' };
    }

    const postedInvoices = (invoices.data ?? []).filter((r) => r.status === 'posted');
    const postedPurchases = (purchases.data ?? []).filter((r) => r.status === 'posted');
    const postedExpenses = (expenses.data ?? []).filter((r) => r.status === 'posted');

    const invoicedToDate = addMoney(...postedInvoices.map((r) => r.amount));
    const receivableOutstanding = addMoney(...postedInvoices.map((r) => r.outstanding_amount));
    const costIncurred = addMoney(
      ...postedPurchases.map((r) => r.amount),
      ...postedExpenses.map((r) => r.amount)
    );
    const payableOutstanding = addMoney(...postedPurchases.map((r) => r.outstanding_amount));

    return {
      success: true,
      data: {
        projectId: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        contractValue: Number(project.contract_value) || 0,
        budgetCost: project.budget_cost === null ? null : Number(project.budget_cost) || 0,
        invoicedToDate,
        receivableOutstanding,
        costIncurred,
        payableOutstanding,
      },
      metadata: {
        basis: 'posted transactions only',
        invoiceRowsSummed: postedInvoices.length,
        purchaseRowsSummed: postedPurchases.length,
        expenseRowsSummed: postedExpenses.length,
      },
    };
  },
};
