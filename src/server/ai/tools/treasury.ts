import { addMoney } from '../../../utils/formatters.js';
import { callerHasPermission } from '../../authContext.js';
import type { ToolDefinition, ArgValidationResult } from '../types.js';
import { asRecord, requireUuid } from '../validation.js';

const TRANSACTION_ROW_CAP = 500;

// No filters in Phase 1 — bank_accounts is a small master-data table.
type GetBankAccountsArgs = Record<string, never>;

export const getBankAccounts: ToolDefinition<GetBankAccountsArgs, unknown[]> = {
  name: 'get_bank_accounts',
  description: 'Lists bank accounts with their current balances.',
  requiredPermission: 'bank_accounts.view',
  validateArgs() {
    return { ok: true, args: {} };
  },
  async handler(ctx) {
    const { data, error } = await ctx.db.from('bank_accounts').select('*').order('id');
    if (error) return { success: false, error: 'Failed to load bank accounts.' };
    return { success: true, data: data ?? [] };
  },
};

interface GetBankTransactionsArgs {
  accountId: string;
}

/**
 * Scoped to bank accounts only (not cash/petty_cash) so this tool has one
 * fixed permission (bank_accounts.view) rather than a caller-suppliable
 * account-type argument that would need a different permission per value
 * — the same static-permission-per-tool reasoning as get_receipts/
 * get_vendor_payments in tools/financial.ts. There is no dedicated
 * per-account ledger table (see docs/ai/CAS-AI-DATABASE-MAP.md); this
 * unions the two real sources that reference a bank account_id directly
 * (money_in.account_id where received_into='bank', money_out.account_id
 * where paid_from='bank') with bank-to-bank/cash/petty_cash `transfers`
 * rows, sorted by date in Node (string ISO-date compare — no monetary
 * arithmetic here, so no float-precision concern).
 */
export const getBankTransactions: ToolDefinition<GetBankTransactionsArgs, unknown[]> = {
  name: 'get_bank_transactions',
  description:
    'Lists recent transactions touching one bank account: receipts credited to it, payments debited from it, and transfers in/out of it. Most recent first, capped at 500 rows total across the three sources.',
  requiredPermission: 'bank_accounts.view',
  validateArgs(raw: unknown): ArgValidationResult<GetBankTransactionsArgs> {
    const r = asRecord(raw);
    const accountId = requireUuid(r.accountId, 'accountId');
    if (accountId.ok === false) return accountId;
    return { ok: true, args: { accountId: accountId.value } };
  },
  async handler(ctx, args) {
    const perSourceCap = Math.floor(TRANSACTION_ROW_CAP / 3);
    const [receipts, payments, transfersOut, transfersIn] = await Promise.all([
      ctx.db
        .from('money_in')
        .select('id,transaction_date,amount,received_from,status')
        .eq('received_into', 'bank')
        .eq('account_id', args.accountId)
        .order('transaction_date', { ascending: false })
        .limit(perSourceCap),
      ctx.db
        .from('money_out')
        .select('id,transaction_date,amount,paid_to,status')
        .eq('paid_from', 'bank')
        .eq('account_id', args.accountId)
        .order('transaction_date', { ascending: false })
        .limit(perSourceCap),
      ctx.db
        .from('transfers')
        .select('id,date,amount,transfer_to_type,transfer_to_id,status')
        .eq('transfer_from_type', 'bank')
        .eq('transfer_from_id', args.accountId)
        .order('date', { ascending: false })
        .limit(perSourceCap),
      ctx.db
        .from('transfers')
        .select('id,date,amount,transfer_from_type,transfer_from_id,status')
        .eq('transfer_to_type', 'bank')
        .eq('transfer_to_id', args.accountId)
        .order('date', { ascending: false })
        .limit(perSourceCap),
    ]);
    if (receipts.error || payments.error || transfersOut.error || transfersIn.error) {
      return { success: false, error: 'Failed to load bank transactions.' };
    }

    const rows = [
      ...(receipts.data ?? []).map((r) => ({ type: 'receipt' as const, date: r.transaction_date, amount: r.amount, counterparty: r.received_from, status: r.status, id: r.id })),
      ...(payments.data ?? []).map((r) => ({ type: 'payment' as const, date: r.transaction_date, amount: r.amount, counterparty: r.paid_to, status: r.status, id: r.id })),
      ...(transfersOut.data ?? []).map((r) => ({ type: 'transfer_out' as const, date: r.date, amount: r.amount, counterparty: `${r.transfer_to_type}:${r.transfer_to_id}`, status: r.status, id: r.id })),
      ...(transfersIn.data ?? []).map((r) => ({ type: 'transfer_in' as const, date: r.date, amount: r.amount, counterparty: `${r.transfer_from_type}:${r.transfer_from_id}`, status: r.status, id: r.id })),
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return { success: true, data: rows, metadata: { count: rows.length, cap: TRANSACTION_ROW_CAP } };
  },
};

export const getCashPosition: ToolDefinition<Record<string, never>, unknown> = {
  name: 'get_cash_position',
  description:
    'Aggregate current balance across bank, cash, and petty-cash accounts. Each leg is included only if the caller holds that specific view permission — a caller missing one is not blocked from the others, but the response says which legs were skipped.',
  requiredPermission: 'treasury.view',
  validateArgs() {
    return { ok: true, args: {} };
  },
  async handler(ctx) {
    const legs: { key: string; permission: string; table: string }[] = [
      { key: 'bank', permission: 'bank_accounts.view', table: 'bank_accounts' },
      { key: 'cash', permission: 'cash.view', table: 'cash_accounts' },
      { key: 'pettyCash', permission: 'petty_cash.view', table: 'petty_cash_accounts' },
    ];

    const result: Record<string, number | null> = {};
    const skipped: string[] = [];
    const balances: number[] = [];

    for (const leg of legs) {
      if (!callerHasPermission(ctx.caller, leg.permission)) {
        result[leg.key] = null;
        skipped.push(leg.key);
        continue;
      }
      const { data, error } = await ctx.db.from(leg.table).select('current_balance');
      if (error) {
        result[leg.key] = null;
        skipped.push(`${leg.key} (query failed)`);
        continue;
      }
      const legTotal = addMoney(...(data ?? []).map((r: any) => r.current_balance));
      result[leg.key] = legTotal;
      balances.push(legTotal);
    }

    return {
      success: true,
      data: { ...result, total: balances.length > 0 ? addMoney(...balances) : null },
      metadata: { skippedLegs: skipped },
    };
  },
};
