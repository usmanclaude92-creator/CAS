import { describe, it, expect } from 'vitest';
import {
  classifyMoneyInImportRows,
  parseMoneyInImportRows,
  MoneyInImportRawRow,
  MoneyInImportState,
} from './moneyInImportValidation';
import { Customer, Project, BankAccount, CashAccount, PettyCashAccount, ClientInvoice, MoneyIn } from '../types';

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

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    code: 'CUST-001',
    name: 'Al Khuwair Towers LLC',
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

function invoice(overrides: Partial<ClientInvoice> = {}): ClientInvoice {
  return {
    id: 'inv-1',
    invoiceType: 'IPC',
    invoiceNumber: 'IPC-2025-003',
    date: '2025-02-01',
    customerId: 'cust-1',
    customerName: 'Al Khuwair Towers LLC',
    projectId: 'proj-1',
    projectName: 'Al Khuwair Towers',
    description: 'Third IPC',
    amount: 20000,
    netAmount: 19047.62,
    vatRate: 5,
    vatAmount: 952.38,
    vatTreatment: 'standard',
    documentRef: 'DOC-IPC-3',
    receivedAmount: 5000,
    outstandingAmount: 15000,
    status: 'posted',
    createdAt: '2025-02-01T00:00:00Z',
    ...overrides,
  };
}

function moneyIn(overrides: Partial<MoneyIn> = {}): MoneyIn {
  return {
    id: 'mi-1',
    transactionDate: '2025-03-15',
    receivedFrom: 'Al Khuwair Towers LLC - Bank Transfer',
    projectId: 'proj-1',
    projectName: 'Al Khuwair Towers',
    against: 'other',
    amount: 15000,
    receivedInto: 'bank',
    accountId: 'bank-1',
    accountName: 'Bank Muscat - Current Account',
    documentRef: 'RCPT-1000',
    status: 'posted',
    createdAt: '2025-03-15T00:00:00Z',
    ...overrides,
  };
}

function baseState(overrides: Partial<MoneyInImportState> = {}): MoneyInImportState {
  return {
    projects: [project()],
    customers: [customer()],
    bankAccounts: [bankAccount()],
    cashAccounts: [] as CashAccount[],
    pettyCashAccounts: [] as PettyCashAccount[],
    clientInvoices: [invoice()],
    moneyInList: [],
    ...overrides,
  };
}

function row(overrides: Partial<MoneyInImportRawRow> = {}): MoneyInImportRawRow {
  return {
    rowNumber: 2,
    transactionDate: '2025-03-15',
    projectName: 'Al Khuwair Towers',
    customerName: '',
    receivedFrom: 'Al Khuwair Towers LLC - Bank Transfer',
    against: 'Other',
    invoiceNumber: '',
    amount: '15000',
    receivedInto: 'Bank',
    accountName: 'Bank Muscat - Current Account',
    documentRef: '',
    remarks: '',
    ...overrides,
  };
}

describe('parseMoneyInImportRows', () => {
  it('maps header columns regardless of order and skips blank rows', () => {
    const grid = [
      ['Account Name', 'Amount (OMR)', 'Transaction Date', 'Project', 'Against', 'Received From'],
      ['Bank Muscat - Current Account', '500', '2025-03-15', 'Al Khuwair Towers', 'Other', 'Cash deposit'],
      ['', '', '', '', '', ''],
    ];
    const rows = parseMoneyInImportRows(grid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      accountName: 'Bank Muscat - Current Account',
      amount: '500',
      transactionDate: '2025-03-15',
      projectName: 'Al Khuwair Towers',
      against: 'Other',
      receivedFrom: 'Cash deposit',
    });
  });
});

describe('classifyMoneyInImportRows', () => {
  it('classifies a fully valid row as new', () => {
    const results = classifyMoneyInImportRows([row()], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].errors).toEqual([]);
    expect(results[0].resolved?.accountId).toBe('bank-1');
  });

  it('rejects a row whose Project does not match any existing project', () => {
    const results = classifyMoneyInImportRows([row({ projectName: 'Nonexistent Project' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing project/);
  });

  it('rejects a row whose Customer Name does not match any existing customer', () => {
    const results = classifyMoneyInImportRows([row({ customerName: 'Ghost Customer' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing customer/);
  });

  it('rejects a row whose Account Name does not match an account of the given type', () => {
    const results = classifyMoneyInImportRows([row({ accountName: 'Unknown Account' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing bank account/);
  });

  it('requires an Invoice Number when Against = Invoice', () => {
    const results = classifyMoneyInImportRows([row({ against: 'Invoice' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Invoice \/ IPC Number is required/);
  });

  it('resolves a valid invoice reference and links it', () => {
    const results = classifyMoneyInImportRows(
      [row({ against: 'Invoice', invoiceNumber: 'IPC-2025-003', customerName: 'Al Khuwair Towers LLC', amount: '10000' })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.invoiceId).toBe('inv-1');
  });

  it('rejects an invoice payment that exceeds the outstanding balance', () => {
    const results = classifyMoneyInImportRows(
      [row({ against: 'Invoice', invoiceNumber: 'IPC-2025-003', amount: '20000' })],
      baseState()
    );
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/exceeds invoice/);
  });

  it('tracks invoice outstanding balance running across multiple rows in the same file', () => {
    const rows = [
      row({ rowNumber: 2, against: 'Invoice', invoiceNumber: 'IPC-2025-003', amount: '9000', documentRef: 'R1' }),
      row({ rowNumber: 3, against: 'Invoice', invoiceNumber: 'IPC-2025-003', amount: '6000', documentRef: 'R2' }),
      // Outstanding was 15000; 9000 + 6000 = 15000 exactly consumes it, so a
      // third payment of any positive amount must be rejected.
      row({ rowNumber: 4, against: 'Invoice', invoiceNumber: 'IPC-2025-003', amount: '1', documentRef: 'R3' }),
    ];
    const results = classifyMoneyInImportRows(rows, baseState());
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('new');
    expect(results[2].status).toBe('error');
    expect(results[2].errors[0]).toMatch(/exceeds invoice/);
  });

  it('flags an exact duplicate of an existing posted record as a blocking error', () => {
    const state = baseState({ moneyInList: [moneyIn()] });
    const results = classifyMoneyInImportRows([row()], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/exact duplicate/);
  });

  it('classifies a row as an update when it only fills a blank field on an existing record', () => {
    const state = baseState({ moneyInList: [moneyIn({ customerId: undefined, customerName: undefined })] });
    const results = classifyMoneyInImportRows([row({ customerName: 'Al Khuwair Towers LLC' })], state);
    expect(results[0].status).toBe('update');
    expect(results[0].matchedExistingId).toBe('mi-1');
    expect(results[0].fillableFields?.customerId).toBe('cust-1');
  });

  it('flags a conflicting non-blank field against a matched record as a blocking error, not a silent overwrite', () => {
    const state = baseState({ moneyInList: [moneyIn({ remarks: 'Original remark' })] });
    const results = classifyMoneyInImportRows([row({ remarks: 'Different remark' })], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors.some((e) => e.includes('Remarks differ'))).toBe(true);
  });

  it('flags two rows in the same file that match each other as a blocking error', () => {
    const results = classifyMoneyInImportRows(
      [row({ rowNumber: 2 }), row({ rowNumber: 3 })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('error');
    expect(results[1].errors[0]).toMatch(/earlier row in this file/);
  });

  it('does not treat rows for different accounts, projects, or customers as matching', () => {
    const state = baseState({
      moneyInList: [moneyIn()],
      bankAccounts: [bankAccount(), bankAccount({ id: 'bank-2', accountName: 'Bank Dhofar - Current Account' })],
    });
    const results = classifyMoneyInImportRows(
      [row({ accountName: 'Bank Dhofar - Current Account' })],
      state
    );
    expect(results[0].status).toBe('new');
  });
});
