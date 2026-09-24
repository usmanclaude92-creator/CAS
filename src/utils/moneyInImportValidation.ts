import {
  Customer,
  Project,
  BankAccount,
  CashAccount,
  PettyCashAccount,
  ClientInvoice,
  MoneyIn,
  TreasuryAccountType,
} from '../types';

export interface MoneyInImportRawRow {
  rowNumber: number; // 1-based spreadsheet row number (header is row 1, so data starts at 2)
  transactionDate: string;
  projectName: string;
  customerName: string;
  receivedFrom: string;
  against: string;
  invoiceNumber: string;
  amount: string;
  receivedInto: string;
  accountName: string;
  documentRef: string;
  remarks: string;
}

export interface MoneyInImportResolved {
  transactionDate: string;
  projectId: string;
  projectName: string;
  customerId?: string;
  customerName?: string;
  receivedFrom: string;
  against: 'invoice' | 'other';
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  receivedInto: TreasuryAccountType;
  accountId: string;
  accountName: string;
  documentRef?: string;
  remarks?: string;
}

export type MoneyInImportRowStatus = 'new' | 'update' | 'error';

export interface MoneyInImportRowResult {
  rowNumber: number;
  raw: MoneyInImportRawRow;
  status: MoneyInImportRowStatus;
  /** Blocking reasons — a non-empty list means this row (and therefore the whole file) cannot be imported as-is. */
  errors: string[];
  resolved?: MoneyInImportResolved;
  /** Set when status = 'update': the id of the existing posted record this row would enrich. */
  matchedExistingId?: string;
  /** Set when status = 'update': the specific currently-blank fields this row would fill in, and their new values. */
  fillableFields?: { customerId?: string; customerName?: string; remarks?: string };
}

export interface MoneyInImportState {
  projects: Project[];
  customers: Customer[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  pettyCashAccounts: PettyCashAccount[];
  clientInvoices: ClientInvoice[];
  moneyInList: MoneyIn[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizes a parsed spreadsheet grid (header row + data rows) into raw import rows. */
export function parseMoneyInImportRows(rows: string[][]): MoneyInImportRawRow[] {
  if (rows.length <= 1) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keywords: string[]) => header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const dateIdx = findCol('transactiondate', 'date');
  const projectIdx = findCol('project');
  const customerIdx = findCol('customername', 'customer');
  const receivedFromIdx = findCol('receivedfrom');
  const againstIdx = findCol('against');
  const invoiceIdx = findCol('invoice');
  const amountIdx = findCol('amount');
  const receivedIntoIdx = findCol('receivedinto');
  const accountIdx = findCol('accountname', 'account');
  const documentRefIdx = findCol('documentref', 'receiptno', 'receipt');
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
      customerName: col(cols, customerIdx),
      receivedFrom: col(cols, receivedFromIdx),
      against: col(cols, againstIdx),
      invoiceNumber: col(cols, invoiceIdx),
      amount: col(cols, amountIdx),
      receivedInto: col(cols, receivedIntoIdx),
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
  projectId: string;
  accountId: string;
  customerId?: string;
  customerName?: string;
  receivedFrom: string;
  against: string;
  invoiceId?: string;
  documentRef?: string;
  remarks?: string;
}

function sameMatchKey(a: MatchCandidate, b: MatchCandidate): boolean {
  if (a.transactionDate !== b.transactionDate) return false;
  if (Math.abs(a.amount - b.amount) > 0.001) return false;
  if (a.projectId !== b.projectId) return false;
  if (a.accountId !== b.accountId) return false;
  if (a.customerId && b.customerId && a.customerId !== b.customerId) return false;
  return true;
}

/**
 * Validates and classifies every row against current master data and
 * existing Money In records:
 *  - 'error'  — blocks the whole import (bad/missing field, unmatched
 *               master-data name, an exact duplicate, or a conflicting
 *               difference against a matched existing record).
 *  - 'update' — matches an existing posted record on date+amount+project+
 *               account (+customer, if both have one), and only fills in
 *               fields that are currently blank there (customerId, remarks)
 *               — never overwrites a value that's already set.
 *  - 'new'    — no match; will be posted as a brand-new transaction.
 *
 * Invoice outstanding balances are tracked running across the file (not
 * just against today's database snapshot), so two rows in one file that
 * both pay down the same invoice validate correctly against each other.
 */
export function classifyMoneyInImportRows(
  rawRows: MoneyInImportRawRow[],
  state: MoneyInImportState
): MoneyInImportRowResult[] {
  const results: MoneyInImportRowResult[] = [];

  const invoiceOutstandingById = new Map<string, number>();
  for (const inv of state.clientInvoices) {
    invoiceOutstandingById.set(inv.id, inv.outstandingAmount);
  }

  const candidatePool: MatchCandidate[] = state.moneyInList.map((m) => ({
    id: m.id,
    transactionDate: m.transactionDate,
    amount: m.amount,
    projectId: m.projectId,
    accountId: m.accountId,
    customerId: m.customerId,
    customerName: m.customerName,
    receivedFrom: m.receivedFrom,
    against: m.against,
    invoiceId: m.invoiceId,
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

    const projectName = raw.projectName.trim();
    const project = projectName
      ? state.projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase())
      : undefined;
    if (!projectName) errors.push('Project is required.');
    else if (!project) errors.push(`Project "${projectName}" does not match any existing project.`);

    const customerNameInput = raw.customerName.trim();
    let customer: Customer | undefined;
    if (customerNameInput) {
      customer = state.customers.find((c) => c.name.toLowerCase() === customerNameInput.toLowerCase());
      if (!customer) errors.push(`Customer "${customerNameInput}" does not match any existing customer.`);
    }

    const receivedFrom = raw.receivedFrom.trim();
    if (!receivedFrom) errors.push('Received From is required.');

    const againstRaw = raw.against.trim().toLowerCase();
    const against: 'invoice' | 'other' | null =
      againstRaw === 'invoice' ? 'invoice' : againstRaw === 'other' ? 'other' : null;
    if (!against) errors.push('Against must be exactly "Invoice" or "Other".');

    const invoiceNumberInput = raw.invoiceNumber.trim();
    let invoice: ClientInvoice | undefined;
    if (against === 'invoice') {
      if (!invoiceNumberInput) {
        errors.push('Invoice / IPC Number is required when Against = Invoice.');
      } else {
        const candidates = state.clientInvoices.filter(
          (i) => i.invoiceNumber.toLowerCase() === invoiceNumberInput.toLowerCase()
        );
        if (candidates.length === 0) {
          errors.push(`Invoice "${invoiceNumberInput}" does not match any existing invoice.`);
        } else if (customer && !candidates.some((i) => i.customerId === customer!.id)) {
          errors.push(`Invoice "${invoiceNumberInput}" does not belong to customer "${customer.name}".`);
        } else {
          invoice = customer ? candidates.find((i) => i.customerId === customer!.id) : candidates[0];
          if (invoice && invoice.status === 'reversed') {
            errors.push(`Invoice "${invoiceNumberInput}" has been reversed and cannot receive a payment.`);
          }
        }
      }
    } else if (invoiceNumberInput) {
      errors.push('Invoice / IPC Number must be blank when Against = Other.');
    }

    const amountRaw = raw.amount.trim();
    const amount = Number(amountRaw);
    if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
      errors.push('Amount must be a positive number.');
    }

    const receivedIntoRaw = raw.receivedInto.trim().toLowerCase().replace(/\s+/g, '_');
    const receivedInto: TreasuryAccountType | null =
      receivedIntoRaw === 'bank' || receivedIntoRaw === 'cash' || receivedIntoRaw === 'petty_cash'
        ? (receivedIntoRaw as TreasuryAccountType)
        : null;
    if (!receivedInto) errors.push('Received Into must be exactly "Bank", "Cash", or "Petty Cash".');

    const accountNameInput = raw.accountName.trim();
    let accountId: string | undefined;
    let resolvedAccountName: string | undefined;
    if (!accountNameInput) {
      errors.push('Account Name is required.');
    } else if (receivedInto) {
      const pool =
        receivedInto === 'bank' ? state.bankAccounts : receivedInto === 'cash' ? state.cashAccounts : state.pettyCashAccounts;
      const account = pool.find((a) => a.accountName.toLowerCase() === accountNameInput.toLowerCase());
      if (!account) {
        errors.push(`Account "${accountNameInput}" does not match any existing ${receivedInto.replace('_', ' ')} account.`);
      } else {
        accountId = account.id;
        resolvedAccountName = account.accountName;
      }
    }

    if (invoice && Number.isFinite(amount) && amount > 0 && errors.length === 0) {
      const remaining = invoiceOutstandingById.get(invoice.id) ?? 0;
      if (amount > remaining + 0.001) {
        errors.push(
          `Amount OMR ${amount.toFixed(3)} exceeds invoice "${invoice.invoiceNumber}"'s remaining outstanding balance of OMR ${remaining.toFixed(3)} (accounting for other rows in this file).`
        );
      } else {
        invoiceOutstandingById.set(invoice.id, remaining - amount);
      }
    }

    if (errors.length > 0) {
      results.push({ rowNumber: raw.rowNumber, raw, status: 'error', errors });
      continue;
    }

    const documentRef = raw.documentRef.trim();
    const remarks = raw.remarks.trim();

    const resolved: MoneyInImportResolved = {
      transactionDate,
      projectId: project!.id,
      projectName: project!.name,
      customerId: customer?.id,
      customerName: customer?.name,
      receivedFrom,
      against: against!,
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      amount,
      receivedInto: receivedInto!,
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
      customerId: resolved.customerId,
      customerName: resolved.customerName,
      receivedFrom: resolved.receivedFrom,
      against: resolved.against,
      invoiceId: resolved.invoiceId,
      documentRef: resolved.documentRef,
      remarks: resolved.remarks,
    };

    const match = candidatePool.find((c) => !consumedIds.has(c.id) && sameMatchKey(c, asCandidate));

    if (match) {
      consumedIds.add(match.id);

      const conflicts: string[] = [];
      const fillable: { customerId?: string; customerName?: string; remarks?: string } = {};

      if (resolved.customerId) {
        if (!match.customerId) {
          fillable.customerId = resolved.customerId;
          fillable.customerName = resolved.customerName;
        } else if (match.customerId !== resolved.customerId) {
          conflicts.push(
            `Customer differs from the existing matching record ("${match.customerName || 'none'}" vs "${resolved.customerName}").`
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

      if (match.receivedFrom && match.receivedFrom !== resolved.receivedFrom) {
        conflicts.push(`Received From differs from the existing matching record ("${match.receivedFrom}" vs "${resolved.receivedFrom}").`);
      }
      if (match.against !== resolved.against) {
        conflicts.push(`Against differs from the existing matching record ("${match.against}" vs "${resolved.against}").`);
      }
      if (resolved.invoiceId && match.invoiceId && match.invoiceId !== resolved.invoiceId) {
        conflicts.push('Linked invoice differs from the existing matching record.');
      }
      if (resolved.documentRef && match.documentRef && match.documentRef !== resolved.documentRef) {
        conflicts.push(`Document Ref differs from the existing matching record ("${match.documentRef}" vs "${resolved.documentRef}").`);
      }

      const matchDescription = `row ${raw.rowNumber} matches ${
        match.id.startsWith('row-') ? `an earlier row in this file (${match.id.replace('row-', 'row ')})` : 'an existing posted transaction'
      } (same date, amount, project and account)`;

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
        // Matches an earlier row in the same file, not a DB record — the
        // richer of the two file rows should simply be treated as the one
        // to import; the thinner earlier row's info is a subset with
        // nothing new, so this later row is a duplicate within the file.
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
