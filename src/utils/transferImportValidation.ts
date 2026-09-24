import { BankAccount, CashAccount, PettyCashAccount, BusinessPartner, AccountTransfer, TreasuryAccountType } from '../types';

export interface TransferImportRawRow {
  rowNumber: number; // 1-based spreadsheet row number (header is row 1, so data starts at 2)
  date: string;
  transferFromType: string;
  transferFromAccount: string;
  transferToType: string;
  transferToAccount: string;
  amount: string;
  documentRef: string;
  remarks: string;
}

export interface TransferImportResolved {
  date: string;
  transferFromType: TreasuryAccountType;
  transferFromId: string;
  transferFromName: string;
  transferToType: TreasuryAccountType;
  transferToId: string;
  transferToName: string;
  amount: number;
  documentRef: string;
  remarks?: string;
}

export type TransferImportRowStatus = 'new' | 'error';

export interface TransferImportRowResult {
  rowNumber: number;
  raw: TransferImportRawRow;
  status: TransferImportRowStatus;
  /** Blocking reasons — a non-empty list means this row (and therefore the whole file) cannot be imported as-is. */
  errors: string[];
  resolved?: TransferImportResolved;
}

export interface TransferImportState {
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  pettyCashAccounts: PettyCashAccount[];
  businessPartners: BusinessPartner[];
  transfers: AccountTransfer[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_TYPE_MAP: Record<string, TreasuryAccountType> = {
  bank: 'bank',
  cash: 'cash',
  pettycash: 'petty_cash',
  partner: 'partner',
};

function resolveAccountType(raw: string): TreasuryAccountType | null {
  const key = raw.trim().toLowerCase().replace(/[^a-z]/g, '');
  return ACCOUNT_TYPE_MAP[key] || null;
}

function findAccount(
  type: TreasuryAccountType,
  nameInput: string,
  state: TransferImportState
): { id: string; name: string } | undefined {
  const needle = nameInput.toLowerCase();
  if (type === 'bank') {
    const acc = state.bankAccounts.find((b) => b.accountName.toLowerCase() === needle);
    return acc ? { id: acc.id, name: acc.accountName } : undefined;
  }
  if (type === 'cash') {
    const acc = state.cashAccounts.find((c) => c.accountName.toLowerCase() === needle);
    return acc ? { id: acc.id, name: acc.accountName } : undefined;
  }
  if (type === 'petty_cash') {
    const acc = state.pettyCashAccounts.find((p) => p.accountName.toLowerCase() === needle);
    return acc ? { id: acc.id, name: acc.accountName } : undefined;
  }
  const acc = state.businessPartners.find((p) => p.name.toLowerCase() === needle);
  return acc ? { id: acc.id, name: acc.name } : undefined;
}

const ACCOUNT_TYPE_LABEL: Record<TreasuryAccountType, string> = {
  bank: 'bank account',
  cash: 'cash account',
  petty_cash: 'petty cash account',
  partner: 'business partner',
};

/**
 * Validates and classifies every row against current master data and
 * existing Transfers. There is no 'update' status here: the `transfers`
 * table has no RLS update policy at all — internal transfers are
 * architecturally immutable once posted, unlike every other module in this
 * system. So an exact match against an existing transfer (same date,
 * amount, from, to, and document ref) is always a blocking duplicate,
 * never something to fill in or merge.
 */
export function classifyTransferImportRows(
  rawRows: TransferImportRawRow[],
  state: TransferImportState
): TransferImportRowResult[] {
  const results: TransferImportRowResult[] = [];

  const rowKey = (
    date: string,
    fromType: string,
    fromId: string,
    toType: string,
    toId: string,
    amount: number,
    documentRef: string
  ) => `${date}|${fromType}|${fromId}|${toType}|${toId}|${amount.toFixed(3)}|${documentRef.toLowerCase()}`;

  const existingKeys = new Set(
    state.transfers.map((t) =>
      rowKey(t.date, t.transferFromType, t.transferFromId, t.transferToType, t.transferToId, t.amount, t.documentRef)
    )
  );
  const keysSeenInFile = new Map<string, number>(); // key -> row number first seen

  for (const raw of rawRows) {
    const errors: string[] = [];

    const date = raw.date.trim();
    if (!date) {
      errors.push('Date is required.');
    } else if (!DATE_PATTERN.test(date) || isNaN(Date.parse(date))) {
      errors.push('Date must be in YYYY-MM-DD format.');
    }

    const fromTypeInput = raw.transferFromType.trim();
    const fromType = resolveAccountType(fromTypeInput);
    if (!fromTypeInput) {
      errors.push('Transfer From Type is required.');
    } else if (!fromType) {
      errors.push('Transfer From Type must be one of: Bank, Cash, Petty Cash, Partner.');
    }

    const toTypeInput = raw.transferToType.trim();
    const toType = resolveAccountType(toTypeInput);
    if (!toTypeInput) {
      errors.push('Transfer To Type is required.');
    } else if (!toType) {
      errors.push('Transfer To Type must be one of: Bank, Cash, Petty Cash, Partner.');
    }

    const fromAccountInput = raw.transferFromAccount.trim();
    let fromAccount: { id: string; name: string } | undefined;
    if (!fromAccountInput) {
      errors.push('Transfer From Account is required.');
    } else if (fromType) {
      fromAccount = findAccount(fromType, fromAccountInput, state);
      if (!fromAccount) {
        errors.push(`Transfer From Account "${fromAccountInput}" does not match any existing ${ACCOUNT_TYPE_LABEL[fromType]}.`);
      }
    }

    const toAccountInput = raw.transferToAccount.trim();
    let toAccount: { id: string; name: string } | undefined;
    if (!toAccountInput) {
      errors.push('Transfer To Account is required.');
    } else if (toType) {
      toAccount = findAccount(toType, toAccountInput, state);
      if (!toAccount) {
        errors.push(`Transfer To Account "${toAccountInput}" does not match any existing ${ACCOUNT_TYPE_LABEL[toType]}.`);
      }
    }

    if (fromType && toType && fromAccount && toAccount && fromType === toType && fromAccount.id === toAccount.id) {
      errors.push('Transfer From and Transfer To accounts cannot be identical.');
    }

    const amountRaw = raw.amount.trim();
    const amount = Number(amountRaw);
    if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
      errors.push('Amount must be a positive number.');
    }

    const documentRef = raw.documentRef.trim();
    if (!documentRef) errors.push('Document Ref is required.');

    if (errors.length === 0 && fromType && toType && fromAccount && toAccount) {
      const key = rowKey(date, fromType, fromAccount.id, toType, toAccount.id, amount, documentRef);
      if (existingKeys.has(key)) {
        errors.push('This transfer already exists (same date, amount, accounts, and document ref) — an exact duplicate.');
      } else if (keysSeenInFile.has(key)) {
        errors.push(`This transfer duplicates an earlier row in this file (row ${keysSeenInFile.get(key)}).`);
      } else {
        keysSeenInFile.set(key, raw.rowNumber);
      }
    }

    if (errors.length > 0) {
      results.push({ rowNumber: raw.rowNumber, raw, status: 'error', errors });
      continue;
    }

    const remarks = raw.remarks.trim();

    const resolved: TransferImportResolved = {
      date,
      transferFromType: fromType!,
      transferFromId: fromAccount!.id,
      transferFromName: fromAccount!.name,
      transferToType: toType!,
      transferToId: toAccount!.id,
      transferToName: toAccount!.name,
      amount,
      documentRef,
      remarks: remarks || undefined,
    };

    results.push({ rowNumber: raw.rowNumber, raw, status: 'new', errors: [], resolved });
  }

  return results;
}

/** Normalizes a parsed spreadsheet grid (header row + data rows) into raw import rows. */
export function parseTransferImportRows(rows: string[][]): TransferImportRawRow[] {
  if (rows.length <= 1) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keywords: string[]) => header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const dateIdx = findCol('date');
  const fromTypeIdx = findCol('transferfromtype', 'fromtype');
  const fromAccountIdx = findCol('transferfromaccount', 'fromaccount');
  const toTypeIdx = findCol('transfertotype', 'totype');
  const toAccountIdx = findCol('transfertoaccount', 'toaccount');
  const amountIdx = findCol('amount');
  const documentRefIdx = findCol('documentref');
  const remarksIdx = findCol('remarks', 'notes');

  const col = (cols: string[], idx: number) => (idx >= 0 ? (cols[idx] ?? '').trim() : '');

  return rows
    .slice(1)
    .map((cols, i) => ({ cols, rowNumber: i + 2 }))
    .filter(({ cols }) => cols.some((v) => v.trim()))
    .map(({ cols, rowNumber }) => ({
      rowNumber,
      date: col(cols, dateIdx),
      transferFromType: col(cols, fromTypeIdx),
      transferFromAccount: col(cols, fromAccountIdx),
      transferToType: col(cols, toTypeIdx),
      transferToAccount: col(cols, toAccountIdx),
      amount: col(cols, amountIdx),
      documentRef: col(cols, documentRefIdx),
      remarks: col(cols, remarksIdx),
    }));
}
