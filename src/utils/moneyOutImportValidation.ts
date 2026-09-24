import {
  Vendor,
  Project,
  BankAccount,
  CashAccount,
  PettyCashAccount,
  Purchase,
  ExpenseHead,
  MoneyOut,
  TreasuryAccountType,
} from '../types';

export interface MoneyOutImportRawRow {
  rowNumber: number; // 1-based spreadsheet row number (header is row 1, so data starts at 2)
  transactionDate: string;
  projectName: string;
  vendorName: string;
  paidTo: string;
  paymentFor: string;
  purchaseInvoiceNumber: string;
  expenseHeadName: string;
  amount: string;
  paidFrom: string;
  accountName: string;
  documentRef: string;
  remarks: string;
}

export interface MoneyOutImportResolved {
  transactionDate: string;
  projectId?: string;
  projectName?: string;
  vendorId?: string;
  vendorName?: string;
  paidTo: string;
  paymentFor: 'purchase' | 'expense' | 'other';
  purchaseId?: string;
  purchaseInvoiceNumber?: string;
  expenseHeadId?: string;
  expenseHeadName?: string;
  amount: number;
  paidFrom: TreasuryAccountType;
  accountId: string;
  accountName: string;
  documentRef?: string;
  remarks?: string;
}

export type MoneyOutImportRowStatus = 'new' | 'update' | 'error';

export interface MoneyOutImportRowResult {
  rowNumber: number;
  raw: MoneyOutImportRawRow;
  status: MoneyOutImportRowStatus;
  /** Blocking reasons — a non-empty list means this row (and therefore the whole file) cannot be imported as-is. */
  errors: string[];
  resolved?: MoneyOutImportResolved;
  /** Set when status = 'update': the id of the existing posted record this row would enrich. */
  matchedExistingId?: string;
  /** Set when status = 'update': the specific currently-blank fields this row would fill in, and their new values. */
  fillableFields?: { vendorId?: string; vendorName?: string; remarks?: string };
}

export interface MoneyOutImportState {
  projects: Project[];
  vendors: Vendor[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  pettyCashAccounts: PettyCashAccount[];
  purchases: Purchase[];
  expenseHeads: ExpenseHead[];
  moneyOutList: MoneyOut[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizes a parsed spreadsheet grid (header row + data rows) into raw import rows. */
export function parseMoneyOutImportRows(rows: string[][]): MoneyOutImportRawRow[] {
  if (rows.length <= 1) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keywords: string[]) => header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const dateIdx = findCol('transactiondate', 'date');
  const projectIdx = findCol('project');
  const vendorIdx = findCol('vendorname', 'vendor');
  const paidToIdx = findCol('paidto');
  const paymentForIdx = findCol('paymentfor');
  const purchaseIdx = findCol('purchaseinvoice', 'purchase');
  const expenseHeadIdx = findCol('expensehead', 'expense');
  const amountIdx = findCol('amount');
  const paidFromIdx = findCol('paidfrom');
  const accountIdx = findCol('accountname', 'account');
  const documentRefIdx = findCol('documentref', 'paymentrefno', 'paymentref', 'receiptno', 'receipt');
  const remarksIdx = findCol('remarks', 'notes');

  const col = (cols: string[], idx: number) => (idx >= 0 ? (cols[idx] ?? '').trim() : '');

  return rows
    .slice(1)
    .map((cols, i) => ({ cols, rowNumber: i + 2 }))
    .filter(({ cols }) => cols.some((v) => v.trim()))
    .map(({ cols, rowNumber }) => ({
      rowNumber,
      transactionDate: col(cols, dateIdx),
      projectName: col(cols, projectIdx),
      vendorName: col(cols, vendorIdx),
      paidTo: col(cols, paidToIdx),
      paymentFor: col(cols, paymentForIdx),
      purchaseInvoiceNumber: col(cols, purchaseIdx),
      expenseHeadName: col(cols, expenseHeadIdx),
      amount: col(cols, amountIdx),
      paidFrom: col(cols, paidFromIdx),
      accountName: col(cols, accountIdx),
      documentRef: col(cols, documentRefIdx),
      remarks: col(cols, remarksIdx),
    }));
}

/** A row-or-existing-record normalized down to just the fields duplicate/update matching cares about. */
interface MatchCandidate {
  id: string;
  transactionDate: string;
  amount: number;
  projectId?: string;
  accountId: string;
  vendorId?: string;
  vendorName?: string;
  paidTo: string;
  paymentFor: string;
  purchaseId?: string;
  documentRef?: string;
  remarks?: string;
}

function sameMatchKey(a: MatchCandidate, b: MatchCandidate): boolean {
  if (a.transactionDate !== b.transactionDate) return false;
  if (Math.abs(a.amount - b.amount) > 0.001) return false;
  if (a.accountId !== b.accountId) return false;
  if (a.projectId && b.projectId && a.projectId !== b.projectId) return false;
  if (a.vendorId && b.vendorId && a.vendorId !== b.vendorId) return false;
  return true;
}

/**
 * Validates and classifies every row against current master data and
 * existing Money Out records — mirrors classifyMoneyInImportRows:
 *  - 'error'  — blocks the whole import (bad/missing field, unmatched
 *               master-data name, an exact duplicate, or a conflicting
 *               difference against a matched existing record).
 *  - 'update' — matches an existing posted record on date+amount+account
 *               (+project/vendor, if both sides have one), and only fills
 *               in fields that are currently blank there (vendorId,
 *               remarks) — never overwrites a value that's already set.
 *  - 'new'    — no match; will be posted as a brand-new transaction.
 *
 * Purchase outstanding balances are tracked running across the file (not
 * just against today's database snapshot), so two rows in one file that
 * both pay down the same purchase validate correctly against each other.
 */
export function classifyMoneyOutImportRows(
  rawRows: MoneyOutImportRawRow[],
  state: MoneyOutImportState
): MoneyOutImportRowResult[] {
  const results: MoneyOutImportRowResult[] = [];

  const purchaseOutstandingById = new Map<string, number>();
  for (const p of state.purchases) {
    purchaseOutstandingById.set(p.id, p.outstandingAmount);
  }

  const candidatePool: MatchCandidate[] = state.moneyOutList.map((m) => ({
    id: m.id,
    transactionDate: m.transactionDate,
    amount: m.amount,
    projectId: m.projectId,
    accountId: m.accountId,
    vendorId: m.vendorId,
    vendorName: m.vendorName,
    paidTo: m.paidTo,
    paymentFor: m.paymentFor,
    purchaseId: m.purchaseId,
    documentRef: m.documentRef,
    remarks: m.remarks,
  }));
  const consumedIds = new Set<string>();

  for (const raw of rawRows) {
    const errors: string[] = [];

    const transactionDate = raw.transactionDate.trim();
    if (!transactionDate) {
      errors.push('Transaction Date is required.');
    } else if (!DATE_PATTERN.test(transactionDate) || isNaN(Date.parse(transactionDate))) {
      errors.push('Transaction Date must be in YYYY-MM-DD format.');
    }

    const projectNameInput = raw.projectName.trim();
    let project: Project | undefined;
    if (projectNameInput) {
      project = state.projects.find((p) => p.name.toLowerCase() === projectNameInput.toLowerCase());
      if (!project) errors.push(`Project "${projectNameInput}" does not match any existing project.`);
    }

    const vendorNameInput = raw.vendorName.trim();
    let vendor: Vendor | undefined;
    if (vendorNameInput) {
      vendor = state.vendors.find((v) => v.name.toLowerCase() === vendorNameInput.toLowerCase());
      if (!vendor) errors.push(`Vendor "${vendorNameInput}" does not match any existing vendor.`);
    }

    const paidTo = raw.paidTo.trim();
    if (!paidTo) errors.push('Paid To is required.');

    const paymentForRaw = raw.paymentFor.trim().toLowerCase();
    const paymentFor: 'purchase' | 'expense' | 'other' | null =
      paymentForRaw === 'purchase' ? 'purchase' : paymentForRaw === 'expense' ? 'expense' : paymentForRaw === 'other' ? 'other' : null;
    if (!paymentFor) errors.push('Payment For must be exactly "Purchase", "Expense", or "Other".');

    const purchaseNumberInput = raw.purchaseInvoiceNumber.trim();
    let purchase: Purchase | undefined;
    if (paymentFor === 'purchase') {
      if (!purchaseNumberInput) {
        errors.push('Purchase Invoice Number is required when Payment For = Purchase.');
      } else {
        const candidates = state.purchases.filter(
          (p) => p.purchaseInvoiceNumber.toLowerCase() === purchaseNumberInput.toLowerCase()
        );
        if (candidates.length === 0) {
          errors.push(`Purchase Invoice "${purchaseNumberInput}" does not match any existing purchase.`);
        } else if (vendor && !candidates.some((p) => p.vendorId === vendor!.id)) {
          errors.push(`Purchase Invoice "${purchaseNumberInput}" does not belong to vendor "${vendor.name}".`);
        } else {
          purchase = vendor ? candidates.find((p) => p.vendorId === vendor!.id) : candidates[0];
          if (purchase && purchase.status === 'reversed') {
            errors.push(`Purchase Invoice "${purchaseNumberInput}" has been reversed and cannot receive a payment.`);
          }
        }
      }
    } else if (purchaseNumberInput) {
      errors.push('Purchase Invoice Number must be blank unless Payment For = Purchase.');
    }

    const expenseHeadNameInput = raw.expenseHeadName.trim();
    let expenseHead: ExpenseHead | undefined;
    if (paymentFor === 'expense') {
      if (!expenseHeadNameInput) {
        errors.push('Expense Head is required when Payment For = Expense.');
      } else {
        expenseHead = state.expenseHeads.find((e) => e.name.toLowerCase() === expenseHeadNameInput.toLowerCase());
        if (!expenseHead) errors.push(`Expense Head "${expenseHeadNameInput}" does not match any existing expense head.`);
      }
    } else if (expenseHeadNameInput) {
      errors.push('Expense Head must be blank unless Payment For = Expense.');
    }

    const amountRaw = raw.amount.trim();
    const amount = Number(amountRaw);
    if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
      errors.push('Amount must be a positive number.');
    }

    const paidFromRaw = raw.paidFrom.trim().toLowerCase().replace(/\s+/g, '_');
    const paidFrom: TreasuryAccountType | null =
      paidFromRaw === 'bank' || paidFromRaw === 'cash' || paidFromRaw === 'petty_cash' ? (paidFromRaw as TreasuryAccountType) : null;
    if (!paidFrom) errors.push('Paid From must be exactly "Bank", "Cash", or "Petty Cash".');

    const accountNameInput = raw.accountName.trim();
    let accountId: string | undefined;
    let resolvedAccountName: string | undefined;
    if (!accountNameInput) {
      errors.push('Account Name is required.');
    } else if (paidFrom) {
      const pool = paidFrom === 'bank' ? state.bankAccounts : paidFrom === 'cash' ? state.cashAccounts : state.pettyCashAccounts;
      const account = pool.find((a) => a.accountName.toLowerCase() === accountNameInput.toLowerCase());
      if (!account) {
        errors.push(`Account "${accountNameInput}" does not match any existing ${paidFrom.replace('_', ' ')} account.`);
      } else {
        accountId = account.id;
        resolvedAccountName = account.accountName;
      }
    }

    if (purchase && Number.isFinite(amount) && amount > 0 && errors.length === 0) {
      const remaining = purchaseOutstandingById.get(purchase.id) ?? 0;
      if (amount > remaining + 0.001) {
        errors.push(
          `Amount OMR ${amount.toFixed(3)} exceeds purchase "${purchase.purchaseInvoiceNumber}"'s remaining outstanding balance of OMR ${remaining.toFixed(3)} (accounting for other rows in this file).`
        );
      } else {
        purchaseOutstandingById.set(purchase.id, remaining - amount);
      }
    }

    if (errors.length > 0) {
      results.push({ rowNumber: raw.rowNumber, raw, status: 'error', errors });
      continue;
    }

    const documentRef = raw.documentRef.trim();
    const remarks = raw.remarks.trim();

    const resolved: MoneyOutImportResolved = {
      transactionDate,
      projectId: project?.id,
      projectName: project?.name,
      vendorId: vendor?.id,
      vendorName: vendor?.name,
      paidTo,
      paymentFor: paymentFor!,
      purchaseId: purchase?.id,
      purchaseInvoiceNumber: purchase?.purchaseInvoiceNumber,
      expenseHeadId: expenseHead?.id,
      expenseHeadName: expenseHead?.name,
      amount,
      paidFrom: paidFrom!,
      accountId: accountId!,
      accountName: resolvedAccountName!,
      documentRef: documentRef || undefined,
      remarks: remarks || undefined,
    };

    const asCandidate: MatchCandidate = {
      id: `row-${raw.rowNumber}`,
      transactionDate: resolved.transactionDate,
      amount: resolved.amount,
      projectId: resolved.projectId,
      accountId: resolved.accountId,
      vendorId: resolved.vendorId,
      vendorName: resolved.vendorName,
      paidTo: resolved.paidTo,
      paymentFor: resolved.paymentFor,
      purchaseId: resolved.purchaseId,
      documentRef: resolved.documentRef,
      remarks: resolved.remarks,
    };

    const match = candidatePool.find((c) => !consumedIds.has(c.id) && sameMatchKey(c, asCandidate));

    if (match) {
      consumedIds.add(match.id);

      const conflicts: string[] = [];
      const fillable: { vendorId?: string; vendorName?: string; remarks?: string } = {};

      if (resolved.vendorId) {
        if (!match.vendorId) {
          fillable.vendorId = resolved.vendorId;
          fillable.vendorName = resolved.vendorName;
        } else if (match.vendorId !== resolved.vendorId) {
          conflicts.push(
            `Vendor differs from the existing matching record ("${match.vendorName || 'none'}" vs "${resolved.vendorName}").`
          );
        }
      }

      if (resolved.remarks) {
        if (!match.remarks) {
          fillable.remarks = resolved.remarks;
        } else if (match.remarks !== resolved.remarks) {
          conflicts.push(`Remarks differ from the existing matching record ("${match.remarks}" vs "${resolved.remarks}").`);
        }
      }

      if (match.paidTo && match.paidTo !== resolved.paidTo) {
        conflicts.push(`Paid To differs from the existing matching record ("${match.paidTo}" vs "${resolved.paidTo}").`);
      }
      if (match.paymentFor !== resolved.paymentFor) {
        conflicts.push(`Payment For differs from the existing matching record ("${match.paymentFor}" vs "${resolved.paymentFor}").`);
      }
      if (resolved.purchaseId && match.purchaseId && match.purchaseId !== resolved.purchaseId) {
        conflicts.push('Linked purchase invoice differs from the existing matching record.');
      }
      if (resolved.documentRef && match.documentRef && match.documentRef !== resolved.documentRef) {
        conflicts.push(`Document Ref differs from the existing matching record ("${match.documentRef}" vs "${resolved.documentRef}").`);
      }

      const matchDescription = `row ${raw.rowNumber} matches ${
        match.id.startsWith('row-') ? `an earlier row in this file (${match.id.replace('row-', 'row ')})` : 'an existing posted transaction'
      } (same date, amount, and account)`;

      if (conflicts.length > 0) {
        results.push({
          rowNumber: raw.rowNumber,
          raw,
          status: 'error',
          errors: [`This ${matchDescription} but has conflicting information:`, ...conflicts],
        });
        continue;
      }

      const hasFillable = Object.keys(fillable).length > 0;
      if (!hasFillable) {
        results.push({
          rowNumber: raw.rowNumber,
          raw,
          status: 'error',
          errors: [`This ${matchDescription} and is an exact duplicate — nothing new to add.`],
        });
        continue;
      }

      if (match.id.startsWith('row-')) {
        results.push({
          rowNumber: raw.rowNumber,
          raw,
          status: 'error',
          errors: [`This ${matchDescription} — please remove one of the two rows before importing.`],
        });
        continue;
      }

      results.push({
        rowNumber: raw.rowNumber,
        raw,
        status: 'update',
        errors: [],
        resolved,
        matchedExistingId: match.id,
        fillableFields: fillable,
      });
      continue;
    }

    candidatePool.push(asCandidate);
    results.push({ rowNumber: raw.rowNumber, raw, status: 'new', errors: [], resolved });
  }

  return results;
}
