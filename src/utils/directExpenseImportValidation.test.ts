import { describe, it, expect } from 'vitest';
import {
  classifyDirectExpenseImportRows,
  parseDirectExpenseImportRows,
  DirectExpenseImportRawRow,
  DirectExpenseImportState,
} from './directExpenseImportValidation';
import { Project, ExpenseHead, BankAccount, CashAccount, PettyCashAccount, DirectExpense } from '../types';

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

function expenseHead(overrides: Partial<ExpenseHead> = {}): ExpenseHead {
  return {
    id: 'exphead-1',
    name: 'Fuel & Transport',
    status: 'active',
    ...overrides,
  };
}

function cashAccount(overrides: Partial<CashAccount> = {}): CashAccount {
  return {
    id: 'cash-1',
    accountName: 'Head Office Cash Box',
    openingBalance: 0,
    currentBalance: 0,
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function directExpense(overrides: Partial<DirectExpense> = {}): DirectExpense {
  return {
    id: 'exp-1',
    expenseDate: '2025-03-02',
    projectId: 'proj-1',
    projectName: 'Al Khuwair Towers',
    expenseHeadId: 'exphead-1',
    expenseHeadName: 'Fuel & Transport',
    description: 'Diesel for site generator',
    amount: 89.25,
    netAmount: 85,
    vatRate: 5,
    vatAmount: 4.25,
    vatTreatment: 'standard',
    paidFrom: 'cash',
    accountId: 'cash-1',
    accountName: 'Head Office Cash Box',
    documentRef: 'EXP-1000',
    status: 'posted',
    createdAt: '2025-03-02T00:00:00Z',
    ...overrides,
  };
}

function baseState(overrides: Partial<DirectExpenseImportState> = {}): DirectExpenseImportState {
  return {
    projects: [project()],
    expenseHeads: [expenseHead()],
    bankAccounts: [] as BankAccount[],
    cashAccounts: [cashAccount()],
    pettyCashAccounts: [] as PettyCashAccount[],
    directExpenses: [],
    ...overrides,
  };
}

function row(overrides: Partial<DirectExpenseImportRawRow> = {}): DirectExpenseImportRawRow {
  return {
    rowNumber: 2,
    expenseDate: '2025-03-02',
    projectName: 'Al Khuwair Towers',
    expenseHeadName: 'Fuel & Transport',
    description: 'Diesel for site generator',
    vendorName: 'Al Maha Petroleum',
    netAmount: '85',
    vatRate: '5',
    vatTreatment: 'standard',
    paidFrom: 'Cash',
    accountName: 'Head Office Cash Box',
    documentRef: '',
    remarks: '',
    ...overrides,
  };
}

describe('parseDirectExpenseImportRows', () => {
  it('maps header columns regardless of order and skips blank rows', () => {
    const grid = [
      ['Vendor Name', 'Net Amount (OMR)', 'Expense Date', 'Project', 'Expense Head', 'Description', 'Paid From', 'Account Name'],
      ['Al Maha Petroleum', '85', '2025-03-02', 'Al Khuwair Towers', 'Fuel & Transport', 'Diesel', 'Cash', 'Head Office Cash Box'],
      ['', '', '', '', '', '', '', ''],
    ];
    const rows = parseDirectExpenseImportRows(grid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      vendorName: 'Al Maha Petroleum',
      netAmount: '85',
      expenseDate: '2025-03-02',
      projectName: 'Al Khuwair Towers',
      expenseHeadName: 'Fuel & Transport',
      description: 'Diesel',
      paidFrom: 'Cash',
      accountName: 'Head Office Cash Box',
    });
  });
});

describe('classifyDirectExpenseImportRows', () => {
  it('classifies a fully valid row as new and computes the VAT split', () => {
    const results = classifyDirectExpenseImportRows([row()], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].errors).toEqual([]);
    expect(results[0].resolved?.vatAmount).toBeCloseTo(4.25, 3);
    expect(results[0].resolved?.grossAmount).toBeCloseTo(89.25, 3);
    expect(results[0].resolved?.vendorName).toBe('Al Maha Petroleum');
  });

  it('accepts any Vendor Name as free text without matching against master data', () => {
    const results = classifyDirectExpenseImportRows([row({ vendorName: 'Some Random Supplier XYZ' })], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.vendorName).toBe('Some Random Supplier XYZ');
  });

  it('allows Vendor Name to be blank', () => {
    const results = classifyDirectExpenseImportRows([row({ vendorName: '' })], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.vendorName).toBeUndefined();
  });

  it('rejects a row whose Project does not match any existing project', () => {
    const results = classifyDirectExpenseImportRows([row({ projectName: 'Ghost Project' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing project/);
  });

  it('rejects a row whose Expense Head does not match any existing expense head', () => {
    const results = classifyDirectExpenseImportRows([row({ expenseHeadName: 'Ghost Head' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing expense head/);
  });

  it('rejects a row whose Account Name does not match an account of the given type', () => {
    const results = classifyDirectExpenseImportRows([row({ accountName: 'Unknown Account' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing cash account/);
  });

  it('rejects a blank Description', () => {
    const results = classifyDirectExpenseImportRows([row({ description: '' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Description is required/);
  });

  it('accepts reverse_charge as a valid VAT Treatment (unlike invoices)', () => {
    const results = classifyDirectExpenseImportRows(
      [row({ vatTreatment: 'reverse_charge', vatRate: '5' })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.vatTreatment).toBe('reverse_charge');
  });

  it('flags an exact duplicate of an existing posted record as a blocking error', () => {
    const state = baseState({ directExpenses: [directExpense({ vendorName: 'Al Maha Petroleum' })] });
    const results = classifyDirectExpenseImportRows([row()], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/exact duplicate/);
  });

  it('classifies a row as an update when it only fills a blank field on an existing record', () => {
    const state = baseState({ directExpenses: [directExpense({ vendorName: undefined })] });
    const results = classifyDirectExpenseImportRows([row({ vendorName: 'Al Maha Petroleum' })], state);
    expect(results[0].status).toBe('update');
    expect(results[0].matchedExistingId).toBe('exp-1');
    expect(results[0].fillableFields?.vendorName).toBe('Al Maha Petroleum');
  });

  it('flags a conflicting non-blank field against a matched record as a blocking error, not a silent overwrite', () => {
    const state = baseState({ directExpenses: [directExpense({ vendorName: 'Different Supplier' })] });
    const results = classifyDirectExpenseImportRows([row({ vendorName: 'Al Maha Petroleum' })], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors.some((e) => e.includes('Vendor Name differs'))).toBe(true);
  });

  it('flags two rows in the same file that match each other as a blocking error', () => {
    const results = classifyDirectExpenseImportRows(
      [row({ rowNumber: 2 }), row({ rowNumber: 3 })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('error');
    expect(results[1].errors[0]).toMatch(/earlier row in this file/);
  });

  it('does not treat rows for different expense heads as matching', () => {
    const state = baseState({
      directExpenses: [directExpense()],
      expenseHeads: [expenseHead(), expenseHead({ id: 'exphead-2', name: 'Statutory Fees & Permits' })],
    });
    const results = classifyDirectExpenseImportRows(
      [row({ expenseHeadName: 'Statutory Fees & Permits' })],
      state
    );
    expect(results[0].status).toBe('new');
  });
});
