import type { ActionToolDefinition, ActionPreviewField } from '../types.js';
import { asRecord, requireUuid, requireString, requireDate, requireEnum, requireAmount, optionalString } from '../../validation.js';
import { generateAiActionRef } from '../refs.js';

const PAID_FROM_VALUES = ['bank', 'cash', 'petty_cash'] as const;
type PaidFrom = (typeof PAID_FROM_VALUES)[number];

const ACCOUNT_TABLE_BY_TYPE: Record<PaidFrom, string> = {
  bank: 'bank_accounts',
  cash: 'cash_accounts',
  petty_cash: 'petty_cash_accounts',
};

interface CreateDirectExpenseArgs {
  expenseDate: string;
  projectId: string;
  expenseHeadId: string;
  description: string;
  amount: number;
  paidFrom: PaidFrom;
  accountId: string;
  documentRef?: string;
  remarks?: string;
}

interface ResolvedNames {
  projectName: string;
  expenseHeadName: string;
  accountName: string;
}

/**
 * The HIGH-risk reference action tool — a genuine financial transaction.
 *
 * Deliberately calls the EXISTING `create_direct_expense` Postgres RPC
 * (supabase/migrations/20260923200000_add_vat_transaction_fields.sql, the
 * same one src/services/accountingService.ts#createDirectExpense uses) via
 * the caller-scoped client, rather than a raw table insert — that RPC does
 * its own has_permission('expenses.create')/can_access_project() check,
 * the account-balance adjustment, and the journal-entry postings
 * atomically. Per the Phase 5 directive's §10 ("reuse existing validated
 * business logic; do not duplicate it"), this is the correct integration
 * point, not a second, competing write path.
 *
 * IMPORTANT, DISCLOSED SCOPE LIMIT: this RPC currently hardcodes
 * status='posted' on every insert — there is no "draft" path in the
 * existing schema for direct expenses (confirmed by inspection; every
 * create_* transaction RPC behaves the same way). An AI-confirmed expense
 * therefore posts and adjusts the account balance IMMEDIATELY, exactly as
 * it would if a human created it through the ordinary Direct Expense form —
 * it is not a low-risk draft. The confirmation preview says so explicitly
 * (buildPreview's `warnings`), and reversal (if ever needed) requires a
 * human with the separate `expenses.reverse` permission using the existing
 * Approvals/reversal flow — this tool never exposes reversal itself.
 *
 * VAT is deliberately NOT an AI-settable parameter in this phase — every
 * AI-created expense is vatTreatment='out_of_scope' (no VAT). Selecting the
 * correct VAT treatment requires tax judgment this tool has no business
 * making; a VAT-bearing expense must still be entered through the ordinary
 * UI. See docs/ai/CAS-AI-PHASE-5.md.
 */
export const createDirectExpenseTool: ActionToolDefinition<CreateDirectExpenseArgs, { id: string; documentRef: string; amount: number }> = {
  name: 'create_direct_expense',
  description:
    'Records and POSTS a direct site expense (a real financial transaction — not a draft) against a project, immediately adjusting the paying account\'s balance. No VAT handling; for VAT-bearing expenses use the regular UI.',
  requiredPermission: 'expenses.create',
  category: 'create',
  riskLevel: 'high',
  transactional: true,
  requiresConfirmation: true,

  validateArgs(raw) {
    const r = asRecord(raw);
    const expenseDate = requireDate(r.expenseDate, 'expenseDate');
    if (expenseDate.ok === false) return expenseDate;
    const projectId = requireUuid(r.projectId, 'projectId');
    if (projectId.ok === false) return projectId;
    const expenseHeadId = requireUuid(r.expenseHeadId, 'expenseHeadId');
    if (expenseHeadId.ok === false) return expenseHeadId;
    const description = requireString(r.description, 'description', 500);
    if (description.ok === false) return description;
    const amount = requireAmount(r.amount, 'amount', { max: 1_000_000 });
    if (amount.ok === false) return amount;
    const paidFrom = requireEnum(r.paidFrom, 'paidFrom', PAID_FROM_VALUES);
    if (paidFrom.ok === false) return paidFrom;
    const accountId = requireUuid(r.accountId, 'accountId');
    if (accountId.ok === false) return accountId;
    const documentRef = optionalString(r.documentRef, 'documentRef', 100);
    if (documentRef.ok === false) return documentRef;
    const remarks = optionalString(r.remarks, 'remarks', 1000);
    if (remarks.ok === false) return remarks;

    return {
      ok: true,
      args: {
        expenseDate: expenseDate.value,
        projectId: projectId.value,
        expenseHeadId: expenseHeadId.value,
        description: description.value,
        amount: amount.value,
        paidFrom: paidFrom.value,
        accountId: accountId.value,
        documentRef: documentRef.value,
        remarks: remarks.value,
      },
    };
  },

  async buildPreview(ctx, args) {
    const resolved = await resolveNames(ctx.db, args);
    if (resolved.ok === false) return resolved;
    const { projectName, expenseHeadName, accountName } = resolved.value;

    const fields: ActionPreviewField[] = [
      { label: 'Project', value: projectName },
      { label: 'Expense Head', value: expenseHeadName },
      { label: 'Description', value: args.description },
      { label: 'Date', value: args.expenseDate },
      { label: 'Amount', value: `OMR ${args.amount.toFixed(3)}` },
      { label: 'Paid From', value: `${accountName} (${args.paidFrom.replace('_', ' ')})` },
    ];
    if (args.documentRef) fields.push({ label: 'Document Ref', value: args.documentRef });

    return {
      ok: true,
      summary: `Post a direct expense of OMR ${args.amount.toFixed(3)} for "${expenseHeadName}" on project "${projectName}"`,
      entityType: 'direct_expense',
      fields,
      financialImpact: { amount: args.amount, currency: 'OMR', direction: 'debit' },
      irreversible: false,
      warnings: [
        `This posts immediately — it is not a draft. "${accountName}" balance will decrease by OMR ${args.amount.toFixed(3)} right away.`,
        'Reversing this afterward requires a separate authorized user action (expenses.reverse permission) via the normal Approvals workflow — this AI Agent cannot undo it.',
      ],
    };
  },

  async handler(ctx, args) {
    const resolved = await resolveNames(ctx.db, args);
    if (resolved.ok === false) {
      return { status: 'validation_failed', error: resolved.error };
    }
    const { projectName, expenseHeadName, accountName } = resolved.value;

    const documentRef = args.documentRef || generateAiActionRef('EXP');
    const entryNumber = generateAiActionRef('JE-EXP');

    const { data, error } = await ctx.db.rpc('create_direct_expense', {
      payload: {
        expenseDate: args.expenseDate,
        projectId: args.projectId,
        expenseHeadId: args.expenseHeadId,
        description: args.description,
        amount: args.amount,
        netAmount: args.amount,
        vatRate: 0,
        vatAmount: 0,
        vatTreatment: 'out_of_scope',
        paidFrom: args.paidFrom,
        accountId: args.accountId,
        documentRef,
        remarks: args.remarks,
        entryNumber,
        journalDescription: `Direct Expense: ${expenseHeadName} (${args.description}) on ${projectName}`,
        debitAccount: `Project Cost - ${expenseHeadName} (${projectName})`,
        creditAccount: `${accountName} (${args.paidFrom.toUpperCase()})`,
        auditDetails: `AI Agent recorded expense — OMR ${args.amount.toFixed(3)} for "${expenseHeadName}" from "${accountName}" on project "${projectName}", confirmed by the user.`,
      },
    });

    if (error || !data) {
      // Never leak the raw Postgres/RPC error (may include internal detail)
      // to the model or the user.
      return { status: 'execution_failed', error: 'Failed to post the expense. Please verify the details and try again.' };
    }

    return {
      status: 'executed',
      data: { id: data.id, documentRef: data.document_ref, amount: Number(data.amount) },
      affectedResource: { table: 'direct_expenses', id: data.id, documentRef: data.document_ref },
    };
  },
};

async function resolveNames(
  db: import('@supabase/supabase-js').SupabaseClient,
  args: CreateDirectExpenseArgs
): Promise<{ ok: true; value: ResolvedNames } | { ok: false; error: string }> {
  const [{ data: project }, { data: expenseHead }, { data: account }] = await Promise.all([
    db.from('projects').select('name').eq('id', args.projectId).maybeSingle(),
    db.from('expense_heads').select('name').eq('id', args.expenseHeadId).maybeSingle(),
    db.from(ACCOUNT_TABLE_BY_TYPE[args.paidFrom]).select('account_name').eq('id', args.accountId).maybeSingle(),
  ]);

  if (!project) return { ok: false, error: 'Project not found or not accessible.' };
  if (!expenseHead) return { ok: false, error: 'Expense head not found.' };
  if (!account) return { ok: false, error: 'Paying account not found.' };

  return {
    ok: true,
    value: { projectName: project.name, expenseHeadName: expenseHead.name, accountName: (account as any).account_name },
  };
}
