import { describe, it, expect } from 'vitest';
import {
  classifyTransferImportRows,
  parseTransferImportRows,
  TransferImportRawRow,
  TransferImportState,
} from './transferImportValidation';
import { BankAccount, CashAccount, PettyCashAccount, BusinessPartner, AccountTransfer } from '../types';

function bankAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 'bank-1',
    bankName: 'Bank Muscat',
    accountName: 'Bank Muscat - Current Account',
    accountNumber: '0011223344',
    currency: 'OMR',
    openingBalance: 0,
    currentBalance: 0,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function pettyCashAccount(overrides: Partial<PettyCashAccount> = {}): PettyCashAccount {
  return {
    id: 'petty-1',
    accountName: 'Site Office Petty Cash',
    openingBalance: 0,
    currentBalance: 0,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function cashAccount(overrides: Partial<CashAccount> = {}): CashAccount {
  return {
    id: 'cash-1',
    accountName: 'Cash in Hand - Head Office',
    openingBalance: 0,
    currentBalance: 0,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function businessPartner(overrides: Partial<BusinessPartner> = {}): BusinessPartner {
  return {
    id: 'partner-1',
    code: 'BP-001',
    name: 'Al Tasneem Holdings',
    partnerType: 'Director/Shareholder',
    openingBalance: 0,
    currentBalance: 0,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function transfer(overrides: Partial<AccountTransfer> = {}): AccountTransfer {
  return {
    id: 'xfer-1',
    date: '2024-10-12',
    transferFromType: 'bank',
    transferFromId: 'bank-1',
    transferFromName: 'Bank Muscat - Current Account',
    transferToType: 'petty_cash',
    transferToId: 'petty-1',
    transferToName: 'Site Office Petty Cash',
    amount: 500,
    documentRef: 'TRF-2024-014',
    status: 'posted',
    createdAt: '2024-10-12T00:00:00Z',
    ...overrides,
  };
}

function baseState(overrides: Partial<TransferImportState> = {}): TransferImportState {
  return {
    bankAccounts: [bankAccount()],
    cashAccounts: [cashAccount()],
    pettyCashAccounts: [pettyCashAccount()],
    businessPartners: [businessPartner()],
    transfers: [],
    ...overrides,
  };
}

function row(overrides: Partial<TransferImportRawRow> = {}): TransferImportRawRow {
  return {
    rowNumber: 2,
    date: '2024-10-12',
    transferFromType: 'Bank',
    transferFromAccount: 'Bank Muscat - Current Account',
    transferToType: 'Petty Cash',
    transferToAccount: 'Site Office Petty Cash',
    amount: '500',
    documentRef: 'TRF-2024-014',
    remarks: '',
    ...overrides,
  };
}

describe('parseTransferImportRows', () => {
  it('maps header columns regardless of order and skips blank rows', () => {
    const grid = [
      ['Amount (OMR)', 'Transfer From Account', 'Transfer From Type', 'Transfer To Type', 'Transfer To Account', 'Date', 'Document Ref'],
      ['500', 'Bank Muscat - Current Account', 'Bank', 'Petty Cash', 'Site Office Petty Cash', '2024-10-12', 'TRF-2024-014'],
      ['', '', '', '', '', '', ''],
    ];
    const rows = parseTransferImportRows(grid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      amount: '500',
      transferFromAccount: 'Bank Muscat - Current Account',
      transferFromType: 'Bank',
      transferToType: 'Petty Cash',
      transferToAccount: 'Site Office Petty Cash',
      date: '2024-10-12',
      documentRef: 'TRF-2024-014',
    });
  });
});

describe('classifyTransferImportRows', () => {
  it('classifies a fully valid row as new', () => {
    const results = classifyTransferImportRows([row()], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].errors).toEqual([]);
    expect(results[0].resolved?.transferFromId).toBe('bank-1');
    expect(results[0].resolved?.transferToId).toBe('petty-1');
  });

  it('resolves a Business Partner account by name', () => {
    const results = classifyTransferImportRows(
      [row({ transferToType: 'Partner', transferToAccount: 'Al Tasneem Holdings' })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.transferToId).toBe('partner-1');
  });

  it('rejects an invalid Transfer From Type', () => {
    const results = classifyTransferImportRows([row({ transferFromType: 'Crypto Wallet' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Transfer From Type must be one of/);
  });

  it('rejects a Transfer From Account that does not match any existing account of that type', () => {
    const results = classifyTransferImportRows([row({ transferFromAccount: 'Ghost Bank Account' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing bank account/);
  });

  it('rejects identical source and destination accounts', () => {
    const results = classifyTransferImportRows(
      [row({ transferToType: 'Bank', transferToAccount: 'Bank Muscat - Current Account' })],
      baseState()
    );
    expect(results[0].status).toBe('error');
    expect(results[0].errors.some((e) => e.includes('cannot be identical'))).toBe(true);
  });

  it('rejects a non-positive Amount', () => {
    const results = classifyTransferImportRows([row({ amount: '0' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Amount must be a positive number/);
  });

  it('rejects a blank Document Ref', () => {
    const results = classifyTransferImportRows([row({ documentRef: '' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Document Ref is required/);
  });

  it('flags an exact duplicate of an existing posted transfer as a blocking error', () => {
    const state = baseState({ transfers: [transfer()] });
    const results = classifyTransferImportRows([row()], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/exact duplicate/);
  });

  it('does not treat a transfer with a different document ref as a duplicate', () => {
    const state = baseState({ transfers: [transfer()] });
    const results = classifyTransferImportRows([row({ documentRef: 'TRF-2024-099' })], state);
    expect(results[0].status).toBe('new');
  });

  it('flags two rows in the same file that match each other as a blocking error', () => {
    const results = classifyTransferImportRows([row({ rowNumber: 2 }), row({ rowNumber: 3 })], baseState());
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('error');
    expect(results[1].errors[0]).toMatch(/duplicates an earlier row in this file/);
  });
});
