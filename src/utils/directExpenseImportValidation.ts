import {
  Project,
  ExpenseHead,
  BankAccount,
  CashAccount,
  PettyCashAccount,
  DirectExpense,
  TreasuryAccountType,
  VatTreatment,
} from '../types';
import { computeVatSplit } from './vat';

export interface DirectExpenseImportRawRow {
  rowNumber: number; // 1-based spreadsheet row number (header is row 1, so data starts at 2)
  expenseDate: string;
  projectName: string;
  expenseHeadName: string;
  description: string;
  vendorName: string;
  netAmount: string;
  vatRate: string;
  vatTreatment: string;
  paidFrom: string;
  accountName: string;
  documentRef: string;
  remarks: string;
}

export interface DirectExpenseImportResolved {
  expenseDate: string;
  projectId: string;
  projectName: string;
  expenseHeadId: string;
  expenseHeadName: string;
  description: string;
  vendorName?: string;
  netAmount: number;
  vatRate: number;
  vatTreatment: VatTreatment;
  vatAmount: number;
  grossAmount: number;
  paidFrom: TreasuryAccountType;
  accountId: string;
  accountName: string;
  documentRef?: string;
  remarks?: string;
}

export type DirectExpenseImportRowStatus = 'new' | 'update' | 'error';

export interface DirectExpenseImportRowResult {
  rowNumber: number;
  raw: DirectExpenseImportRawRow;
  status: DirectExpenseImportRowStatus;
  /** Blocking reasons — a non-empty list means this row (and therefore the whole file) cannot be imported as-is. */
  errors: string[];
  resolved?: DirectExpenseImportResolved;
  /** Set when status = 'update': the id of the existing posted record this row would enrich. */
  matchedExistingId?: string;
  /** Set when status = 'update': the specific currently-blank fields this row would fill in, and their new values. */
  fillableFields?: { vendorName?: string; remarks?: string };
}

export interface DirectExpenseImportState {
  projects: Project[];
  expenseHeads: ExpenseHead[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  pettyCashAccounts: PettyCashAccount[];
  directExpenses: DirectExpense[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_VAT_TREATMENTS = new Set<string>(['standard', 'zero_rated', 'exempt', 'out_of_scope', 'reverse_charge']);

/** Normalizes a parsed spreadsheet grid (header row + data rows) into raw import rows. */
export function parseDirectExpenseImportRows(rows: string[][]): DirectExpenseImportRawRow[] {
  if (rows.length <= 1) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keywords: string[]) => header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const dateIdx = findCol('expensedate', 'date');
  const projectIdx = findCol('project');
  const expenseHeadIdx = findCol('expensehead');
  const descriptionIdx = findCol('description');
  const vendorIdx = findCol('vendorname', 'vendor');
  const netAmountIdx = findCol('netamount');
  const vatRateIdx = findCol('vatrate');
  const vatTreatmentIdx = findCol('vattreatment');
  const paidFromIdx = findCol('paidfrom');
  const accountIdx = findCol('accountname', 'account');
  const documentRefIdx = findCol('documentref');
  const remarksIdx = findCol('remarks', 'notes');

  const col = (cols: string[], idx: number) => (idx >= 0 ? (cols[idx] ?? '').trim() : '');

  return rows
    .slice(1)
    .map((cols, i) => ({ cols, rowNumber: i + 2 }))
    .filter(({ cols }) => cols.some((v) => v.trim()))
    .map(({ cols, rowNumber }) => ({
      rowNumber,
      expenseDate: col(cols, dateIdx),
      projectName: col(cols, projectIdx),
      expenseHeadName: col(cols, expenseHeadIdx),
      description: col(cols, descriptionIdx),
      vendorName: col(cols, vendorIdx),
      netAmount: col(cols, netAmountIdx),
      vatRate: col(cols, vatRateIdx),
      vatTreatment: col(cols, vatTreatmentIdx),
      paidFrom: col(cols, paidFromIdx),
      accountName: col(cols, accountIdx),
      documentRef: col(cols, documentRefIdx),
      remarks: col(cols, remarksIdx),
    }));
}

/** A row-or-existing-record normalized down to just the fields duplicate/update matching cares about. */
interface MatchCandidate {
  id: string;
  expenseDate: string;
  amount: number;
  projectId: string;
  expenseHeadId: string;
  accountId: string;
  vendorName?: string;
  documentRef?: string;
  remarks?: string;
}

function sameMatchKey(a: MatchCandidate, b: MatchCandidate): boolean {
  return (
    a.expenseDate === b.expenseDate &&
    Math.abs(a.amount - b.amount) < 0.001 &&
    a.projectId === b.projectId &&
    a.expenseHeadId === b.expenseHeadId &&
    a.accountId === b.accountId
  );
}

/**
 * Validates and classifies every row against current master data and
 * existing Direct Expenses — mirrors classifyMoneyOutImportRows. Vendor
 * Name is deliberately free text: it has no formal master-data table to
 * match against (direct_expenses has never had a Vendor link), so it is
 * accepted as-is, trimmed, with no existence check.
 *
 *  - 'error'  — blocks the whole import (bad/missing field, unmatched
 *               master-data name, an exact duplicate, or a conflicting
 *               difference against a matched existing record).
 *  - 'update' — matches an existing posted record on date+amount+project+
 *               expense head+account, and only fills in fields that are
 *               currently blank there (vendorName, remarks) — never
 *               overwrites a value that's already set.
 *  - 'new'    — no match; will be posted as a brand-new transaction.
 */
export function classifyDirectExpenseImportRows(
  rawRows: DirectExpenseImportRawRow[],
  state: DirectExpenseImportState
): DirectExpenseImportRowResult[] {
  const results: DirectExpenseImportRowResult[] = [];

  const candidatePool: MatchCandidate[] = state.directExpenses.map((e) => ({
    id: e.id,
    expenseDate: e.expenseDate,
    amount: e.amount,
    projectId: e.projectId,
    expenseHeadId: e.expenseHeadId,
    accountId: e.accountId,
    vendorName: e.vendorName,
    documentRef: e.documentRef,
    remarks: e.remarks,
  }));
  const consumedIds = new Set<string>();

  for (const raw of rawRows) {
    const errors: string[] = [];

    const expenseDate = raw.expenseDate.trim();
    if (!expenseDate) {
      errors.push('Expense Date is required.');
    } else if (!DATE_PATTERN.test(expenseDate) || isNaN(Date.parse(expenseDate))) {
      errors.push('Expense Date must be in YYYY-MM-DD format.');
    }

    const projectNameInput = raw.projectName.trim();
    let project: Project | undefined;
    if (!projectNameInput) {
      errors.push('Project is required.');
    } else {
      project = state.projects.find((p) => p.name.toLowerCase() === projectNameInput.toLowerCase());
      if (!project) errors.push(`Project "${projectNameInput}" does not match any existing project.`);
    }

    const expenseHeadNameInput = raw.expenseHeadName.trim();
    let expenseHead: ExpenseHead | undefined;
    if (!expenseHeadNameInput) {
      errors.push('Expense Head is required.');
    } else {
      expenseHead = state.expenseHeads.find((e) => e.name.toLowerCase() === expenseHeadNameInput.toLowerCase());
      if (!expenseHead) errors.push(`Expense Head "${expenseHeadNameInput}" does not match any existing expense head.`);
    }

    const description = raw.description.trim();
    if (!description) errors.push('Description is required.');

    const netAmountRaw = raw.netAmount.trim();
    const netAmount = Number(netAmountRaw);
    if (!netAmountRaw || !Number.isFinite(netAmount) || netAmount <= 0) {
      errors.push('Net Amount must be a positive number.');
    }

    const vatRateRaw = raw.vatRate.trim();
    const vatRate = vatRateRaw === '' ? 0 : Number(vatRateRaw);
    if (vatRateRaw !== '' && (!Number.isFinite(vatRate) || vatRate < 0)) {
      errors.push('VAT Rate must be zero or a positive number.');
    }

    const vatTreatmentRaw = raw.vatTreatment.trim().toLowerCase();
    const vatTreatment: VatTreatment | null = VALID_VAT_TREATMENTS.has(vatTreatmentRaw)
      ? (vatTreatmentRaw as VatTreatment)
      : null;
    if (!vatTreatmentRaw) {
      errors.push('VAT Treatment is required.');
    } else if (!vatTreatment) {
      errors.push(
        'VAT Treatment must be exactly "standard", "zero_rated", "exempt", "out_of_scope", or "reverse_charge".'
      );
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

    if (errors.length > 0) {
      results.push({ rowNumber: raw.rowNumber, raw, status: 'error', errors });
      continue;
    }

    const vendorName = raw.vendorName.trim();
    const documentRef = raw.documentRef.trim();
    const remarks = raw.remarks.trim();
    const vat = computeVatSplit(netAmount, vatRate, vatTreatment!);

    const resolved: DirectExpenseImportResolved = {
      expenseDate,
      projectId: project!.id,
      projectName: project!.name,
      expenseHeadId: expenseHead!.id,
      expenseHeadName: expenseHead!.name,
      description,
      vendorName: vendorName || undefined,
      netAmount: vat.netAmount,
      vatRate: vat.vatRate,
      vatTreatment: vat.vatTreatment,
      vatAmount: vat.vatAmount,
      grossAmount: vat.grossAmount,
      paidFrom: paidFrom!,
      accountId: accountId!,
      accountName: resolvedAccountName!,
      documentRef: documentRef || undefined,
      remarks: remarks || undefined,
    };

    const asCandidate: MatchCandidate = {
      id: `row-${raw.rowNumber}`,
      expenseDate: resolved.expenseDate,
      amount: resolved.grossAmount,
      projectId: resolved.projectId,
      expenseHeadId: resolved.expenseHeadId,
      accountId: resolved.accountId,
      vendorName: resolved.vendorName,
      documentRef: resolved.documentRef,
      remarks: resolved.remarks,
    };

    const match = candidatePool.find((c) => !consumedIds.has(c.id) && sameMatchKey(c, asCandidate));

    if (match) {
      consumedIds.add(match.id);

      const conflicts: string[] = [];
      const fillable: { vendorName?: string; remarks?: string } = {};

      if (resolved.vendorName) {
        if (!match.vendorName) {
          fillable.vendorName = resolved.vendorName;
        } else if (match.vendorName !== resolved.vendorName) {
          conflicts.push(`Vendor Name differs from the existing matching record ("${match.vendorName}" vs "${resolved.vendorName}").`);
        }
      }

      if (resolved.remarks) {
        if (!match.remarks) {
          fillable.remarks = resolved.remarks;
        } else if (match.remarks !== resolved.remarks) {
          conflicts.push(`Remarks differ from the existing matching record ("${match.remarks}" vs "${resolved.remarks}").`);
        }
      }

      if (resolved.documentRef && match.documentRef && match.documentRef !== resolved.documentRef) {
        conflicts.push(`Document Ref differs from the existing matching record ("${match.documentRef}" vs "${resolved.documentRef}").`);
      }

      const matchDescription = `row ${raw.rowNumber} matches ${
        match.id.startsWith('row-') ? `an earlier row in this file (${match.id.replace('row-', 'row ')})` : 'an existing posted transaction'
      } (same date, amount, project, expense head, and account)`;

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
