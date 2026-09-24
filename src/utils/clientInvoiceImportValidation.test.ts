import { describe, it, expect } from 'vitest';
import {
  classifyClientInvoiceImportRows,
  parseClientInvoiceImportRows,
  ClientInvoiceImportRawRow,
  ClientInvoiceImportState,
} from './clientInvoiceImportValidation';
import { Customer, Project, ClientInvoice } from '../types';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    code: 'CUST-001',
    name: 'Al Khuwair Towers LLC',
    openingBalance: 0,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    code: 'PRJ-001',
    name: 'Al Khuwair Towers',
    customerId: 'cust-1',
    contractValue: 100000,
    startDate: '2024-01-01',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function invoice(overrides: Partial<ClientInvoice> = {}): ClientInvoice {
  return {
    id: 'inv-1',
    invoiceType: 'IPC',
    invoiceNumber: 'IPC-2024-014',
    date: '2024-11-10',
    customerId: 'cust-1',
    customerName: 'Al Khuwair Towers LLC',
    projectId: 'proj-1',
    projectName: 'Al Khuwair Towers',
    description: 'Existing IPC',
    amount: 21000,
    netAmount: 20000,
    vatRate: 5,
    vatAmount: 1000,
    vatTreatment: 'standard',
    documentRef: 'DOC-IPC-14',
    receivedAmount: 0,
    outstandingAmount: 21000,
    status: 'posted',
    createdAt: '2024-11-10T00:00:00Z',
    ...overrides,
  };
}

function baseState(overrides: Partial<ClientInvoiceImportState> = {}): ClientInvoiceImportState {
  return {
    customers: [customer()],
    projects: [project()],
    clientInvoices: [],
    ...overrides,
  };
}

function row(overrides: Partial<ClientInvoiceImportRawRow> = {}): ClientInvoiceImportRawRow {
  return {
    rowNumber: 2,
    invoiceType: 'IPC',
    invoiceNumber: 'IPC-2024-014',
    date: '2024-11-10',
    customerName: 'Al Khuwair Towers LLC',
    projectName: 'Al Khuwair Towers',
    description: 'Interim Payment Certificate No. 14',
    netAmount: '20000',
    vatRate: '5',
    vatTreatment: 'standard',
    documentRef: 'DOC-IPC-14',
    remarks: '',
    ...overrides,
  };
}

describe('parseClientInvoiceImportRows', () => {
  it('maps header columns regardless of order and skips blank rows', () => {
    const grid = [
      ['Net Amount (OMR)', 'Invoice Number', 'Invoice Type', 'Customer Name', 'Project Name', 'Date', 'VAT Rate (%)', 'VAT Treatment', 'Document Ref'],
      ['20000', 'IPC-2024-014', 'IPC', 'Al Khuwair Towers LLC', 'Al Khuwair Towers', '2024-11-10', '5', 'standard', 'DOC-IPC-14'],
      ['', '', '', '', '', '', '', '', ''],
    ];
    const rows = parseClientInvoiceImportRows(grid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      netAmount: '20000',
      invoiceNumber: 'IPC-2024-014',
      invoiceType: 'IPC',
      customerName: 'Al Khuwair Towers LLC',
      projectName: 'Al Khuwair Towers',
      date: '2024-11-10',
      vatRate: '5',
      vatTreatment: 'standard',
      documentRef: 'DOC-IPC-14',
    });
  });
});

describe('classifyClientInvoiceImportRows', () => {
  it('classifies a fully valid row as new and computes the VAT split', () => {
    const results = classifyClientInvoiceImportRows([row()], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].errors).toEqual([]);
    expect(results[0].resolved?.vatAmount).toBeCloseTo(1000, 3);
    expect(results[0].resolved?.grossAmount).toBeCloseTo(21000, 3);
  });

  it('rejects an invalid Invoice Type', () => {
    const results = classifyClientInvoiceImportRows([row({ invoiceType: 'Credit Note' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Invoice Type must be exactly/);
  });

  it('rejects a blank Invoice Number', () => {
    const results = classifyClientInvoiceImportRows([row({ invoiceNumber: '' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Invoice Number is required/);
  });

  it('rejects a row whose invoice number already exists in the database', () => {
    const state = baseState({ clientInvoices: [invoice()] });
    const results = classifyClientInvoiceImportRows([row()], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/already exists/);
  });

  it('rejects two rows in the same file using the same invoice number', () => {
    const results = classifyClientInvoiceImportRows(
      [row({ rowNumber: 2 }), row({ rowNumber: 3 })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('error');
    expect(results[1].errors[0]).toMatch(/used more than once in this file/);
  });

  it('rejects a row whose Customer Name does not match any existing customer', () => {
    const results = classifyClientInvoiceImportRows([row({ customerName: 'Ghost Customer' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing customer/);
  });

  it('rejects a row whose Project Name does not match any existing project', () => {
    const results = classifyClientInvoiceImportRows([row({ projectName: 'Ghost Project' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing project/);
  });

  it('rejects an invalid VAT Treatment', () => {
    const results = classifyClientInvoiceImportRows([row({ vatTreatment: 'reverse_charge' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/VAT Treatment must be exactly/);
  });

  it('computes zero VAT for a zero_rated invoice regardless of the VAT Rate column', () => {
    const results = classifyClientInvoiceImportRows(
      [row({ vatTreatment: 'zero_rated', vatRate: '5', netAmount: '5000' })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.vatAmount).toBe(0);
    expect(results[0].resolved?.grossAmount).toBeCloseTo(5000, 3);
  });

  it('rejects a non-positive Net Amount', () => {
    const results = classifyClientInvoiceImportRows([row({ netAmount: '0' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Net Amount must be a positive number/);
  });

  it('rejects a blank Document Ref', () => {
    const results = classifyClientInvoiceImportRows([row({ documentRef: '' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Document Ref is required/);
  });
});
