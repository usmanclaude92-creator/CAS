import { describe, it, expect } from 'vitest';
import {
  classifyMoneyOutImportRows,
  parseMoneyOutImportRows,
  MoneyOutImportRawRow,
  MoneyOutImportState,
} from './moneyOutImportValidation';
import { Vendor, Project, BankAccount, CashAccount, PettyCashAccount, Purchase, ExpenseHead, MoneyOut } from '../types';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    code: 'PRJ-001',
    name: 'Al Khuwair Towers',
    customerId: 'cust-1',
    contractValue: 100000,
    startDate: '2025-01-01',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function vendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vend-1',
    code: 'VND-001',
    name: 'Muscat Cement Products',
    openingBalance: 0,
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

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
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'purch-1',
    purchaseInvoiceNumber: 'PINV-2025-011',
    date: '2025-02-01',
    vendorId: 'vend-1',
    vendorName: 'Muscat Cement Products',
    projectId: 'proj-1',
    projectName: 'Al Khuwair Towers',
    purchaseCategory: 'Materials',
    description: 'Cement supply',
    amount: 12000,
    netAmount: 11428.57,
    vatRate: 5,
    vatAmount: 571.43,
    vatTreatment: 'standard',
    documentRef: 'DOC-PINV-11',
    paidAmount: 4000,
    outstandingAmount: 8000,
    status: 'posted',
    createdAt: '2025-02-01T00:00:00Z',
    ...overrides,
  };
}

function expenseHead(overrides: Partial<ExpenseHead> = {}): ExpenseHead {
  return {
    id: 'exphead-1',
    name: 'Statutory Fees & Permits',
    status: 'active',
    ...overrides,
  };
}

function moneyOut(overrides: Partial<MoneyOut> = {}): MoneyOut {
  return {
    id: 'mo-1',
    transactionDate: '2025-03-20',
    paidTo: 'Muscat Cement Products - Bank Transfer',
    projectId: 'proj-1',
    projectName: 'Al Khuwair Towers',
    paymentFor: 'other',
    amount: 8000,
    paidFrom: 'bank',
    accountId: 'bank-1',
    accountName: 'Bank Muscat - Current Account',
    documentRef: 'PAY-1000',
    status: 'posted',
    createdAt: '2025-03-20T00:00:00Z',
    ...overrides,
  };
}

function baseState(overrides: Partial<MoneyOutImportState> = {}): MoneyOutImportState {
  return {
    projects: [project()],
    vendors: [vendor()],
    bankAccounts: [bankAccount()],
    cashAccounts: [] as CashAccount[],
    pettyCashAccounts: [] as PettyCashAccount[],
    purchases: [purchase()],
    expenseHeads: [expenseHead()],
    moneyOutList: [],
    ...overrides,
  };
}

function row(overrides: Partial<MoneyOutImportRawRow> = {}): MoneyOutImportRawRow {
  return {
    rowNumber: 2,
    transactionDate: '2025-03-20',
    projectName: 'Al Khuwair Towers',
    vendorName: '',
    paidTo: 'Muscat Cement Products - Bank Transfer',
    paymentFor: 'Other',
    purchaseInvoiceNumber: '',
    expenseHeadName: '',
    amount: '8000',
    paidFrom: 'Bank',
    accountName: 'Bank Muscat - Current Account',
    documentRef: '',
    remarks: '',
    ...overrides,
  };
}

describe('parseMoneyOutImportRows', () => {
  it('maps header columns regardless of order and skips blank rows', () => {
    const grid = [
      ['Account Name', 'Amount (OMR)', 'Transaction Date', 'Paid To', 'Payment For'],
      ['Bank Muscat - Current Account', '500', '2025-03-20', 'Site cleanup crew', 'Other'],
      ['', '', '', '', ''],
    ];
    const rows = parseMoneyOutImportRows(grid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      accountName: 'Bank Muscat - Current Account',
      amount: '500',
      transactionDate: '2025-03-20',
      paidTo: 'Site cleanup crew',
      paymentFor: 'Other',
    });
  });
});

describe('classifyMoneyOutImportRows', () => {
  it('classifies a fully valid row as new', () => {
    const results = classifyMoneyOutImportRows([row()], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].errors).toEqual([]);
    expect(results[0].resolved?.accountId).toBe('bank-1');
  });

  it('allows Project to be blank since it is optional for Money Out', () => {
    const results = classifyMoneyOutImportRows([row({ projectName: '' })], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.projectId).toBeUndefined();
  });

  it('rejects a row whose Vendor Name does not match any existing vendor', () => {
    const results = classifyMoneyOutImportRows([row({ vendorName: 'Ghost Vendor' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing vendor/);
  });

  it('rejects a row whose Account Name does not match an account of the given type', () => {
    const results = classifyMoneyOutImportRows([row({ accountName: 'Unknown Account' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing bank account/);
  });

  it('requires a Purchase Invoice Number when Payment For = Purchase', () => {
    const results = classifyMoneyOutImportRows([row({ paymentFor: 'Purchase' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Purchase Invoice Number is required/);
  });

  it('requires an Expense Head when Payment For = Expense', () => {
    const results = classifyMoneyOutImportRows([row({ paymentFor: 'Expense' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Expense Head is required/);
  });

  it('resolves a valid purchase reference and links it', () => {
    const results = classifyMoneyOutImportRows(
      [row({ paymentFor: 'Purchase', purchaseInvoiceNumber: 'PINV-2025-011', vendorName: 'Muscat Cement Products', amount: '5000' })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.purchaseId).toBe('purch-1');
  });

  it('rejects a purchase payment that exceeds the outstanding balance', () => {
    const results = classifyMoneyOutImportRows(
      [row({ paymentFor: 'Purchase', purchaseInvoiceNumber: 'PINV-2025-011', amount: '9000' })],
      baseState()
    );
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/exceeds purchase/);
  });

  it('tracks purchase outstanding balance running across multiple rows in the same file', () => {
    const rows = [
      row({ rowNumber: 2, paymentFor: 'Purchase', purchaseInvoiceNumber: 'PINV-2025-011', amount: '5000', documentRef: 'R1' }),
      row({ rowNumber: 3, paymentFor: 'Purchase', purchaseInvoiceNumber: 'PINV-2025-011', amount: '3000', documentRef: 'R2' }),
      // Outstanding was 8000; 5000 + 3000 = 8000 exactly consumes it, so a
      // third payment of any positive amount must be rejected.
      row({ rowNumber: 4, paymentFor: 'Purchase', purchaseInvoiceNumber: 'PINV-2025-011', amount: '1', documentRef: 'R3' }),
    ];
    const results = classifyMoneyOutImportRows(rows, baseState());
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('new');
    expect(results[2].status).toBe('error');
    expect(results[2].errors[0]).toMatch(/exceeds purchase/);
  });

  it('resolves a valid expense head reference and links it', () => {
    const results = classifyMoneyOutImportRows(
      [row({ paymentFor: 'Expense', expenseHeadName: 'Statutory Fees & Permits', amount: '350' })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.expenseHeadId).toBe('exphead-1');
  });

  it('flags an exact duplicate of an existing posted record as a blocking error', () => {
    const state = baseState({ moneyOutList: [moneyOut()] });
    const results = classifyMoneyOutImportRows([row()], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/exact duplicate/);
  });

  it('classifies a row as an update when it only fills a blank field on an existing record', () => {
    const state = baseState({ moneyOutList: [moneyOut({ vendorId: undefined, vendorName: undefined })] });
    const results = classifyMoneyOutImportRows([row({ vendorName: 'Muscat Cement Products' })], state);
    expect(results[0].status).toBe('update');
    expect(results[0].matchedExistingId).toBe('mo-1');
    expect(results[0].fillableFields?.vendorId).toBe('vend-1');
  });

  it('flags a conflicting non-blank field against a matched record as a blocking error, not a silent overwrite', () => {
    const state = baseState({ moneyOutList: [moneyOut({ remarks: 'Original remark' })] });
    const results = classifyMoneyOutImportRows([row({ remarks: 'Different remark' })], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors.some((e) => e.includes('Remarks differ'))).toBe(true);
  });

  it('flags two rows in the same file that match each other as a blocking error', () => {
    const results = classifyMoneyOutImportRows([row({ rowNumber: 2 }), row({ rowNumber: 3 })], baseState());
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('error');
    expect(results[1].errors[0]).toMatch(/earlier row in this file/);
  });

  it('does not treat rows for different accounts as matching', () => {
    const state = baseState({
      moneyOutList: [moneyOut()],
      bankAccounts: [bankAccount(), bankAccount({ id: 'bank-2', accountName: 'Bank Dhofar - Current Account' })],
    });
    const results = classifyMoneyOutImportRows([row({ accountName: 'Bank Dhofar - Current Account' })], state);
    expect(results[0].status).toBe('new');
  });
});
