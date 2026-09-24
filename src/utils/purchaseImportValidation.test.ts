import { describe, it, expect } from 'vitest';
import {
  classifyPurchaseImportRows,
  parsePurchaseImportRows,
  PurchaseImportRawRow,
  PurchaseImportState,
} from './purchaseImportValidation';
import { Vendor, Project, Purchase } from '../types';

function vendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vend-1',
    code: 'VND-001',
    name: 'Muscat Cement Products',
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

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'purch-1',
    purchaseInvoiceNumber: 'PINV-2024-088',
    date: '2024-10-05',
    vendorId: 'vend-1',
    vendorName: 'Muscat Cement Products',
    projectId: 'proj-1',
    projectName: 'Al Khuwair Towers',
    purchaseCategory: 'Materials',
    description: 'Cement supply',
    amount: 12600,
    netAmount: 12000,
    vatRate: 5,
    vatAmount: 600,
    vatTreatment: 'standard',
    documentRef: 'DOC-PINV-88',
    paidAmount: 0,
    outstandingAmount: 12600,
    status: 'posted',
    createdAt: '2024-10-05T00:00:00Z',
    ...overrides,
  };
}

function baseState(overrides: Partial<PurchaseImportState> = {}): PurchaseImportState {
  return {
    vendors: [vendor()],
    projects: [project()],
    purchases: [],
    ...overrides,
  };
}

function row(overrides: Partial<PurchaseImportRawRow> = {}): PurchaseImportRawRow {
  return {
    rowNumber: 2,
    purchaseInvoiceNumber: 'PINV-2024-088',
    date: '2024-10-05',
    vendorName: 'Muscat Cement Products',
    projectName: 'Al Khuwair Towers',
    purchaseCategory: 'Materials',
    description: 'Cement supply for foundation works',
    netAmount: '12000',
    vatRate: '5',
    vatTreatment: 'standard',
    documentRef: 'DOC-PINV-88',
    remarks: '',
    ...overrides,
  };
}

describe('parsePurchaseImportRows', () => {
  it('maps header columns regardless of order and skips blank rows', () => {
    const grid = [
      ['Net Amount (OMR)', 'Purchase Invoice Number', 'Vendor Name', 'Project Name', 'Date', 'VAT Rate (%)', 'VAT Treatment', 'Document Ref'],
      ['12000', 'PINV-2024-088', 'Muscat Cement Products', 'Al Khuwair Towers', '2024-10-05', '5', 'standard', 'DOC-PINV-88'],
      ['', '', '', '', '', '', '', ''],
    ];
    const rows = parsePurchaseImportRows(grid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      netAmount: '12000',
      purchaseInvoiceNumber: 'PINV-2024-088',
      vendorName: 'Muscat Cement Products',
      projectName: 'Al Khuwair Towers',
      date: '2024-10-05',
      vatRate: '5',
      vatTreatment: 'standard',
      documentRef: 'DOC-PINV-88',
    });
  });
});

describe('classifyPurchaseImportRows', () => {
  it('classifies a fully valid row as new and computes the VAT split', () => {
    const results = classifyPurchaseImportRows([row()], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].errors).toEqual([]);
    expect(results[0].resolved?.vatAmount).toBeCloseTo(600, 3);
    expect(results[0].resolved?.grossAmount).toBeCloseTo(12600, 3);
  });

  it('rejects a blank Purchase Invoice Number', () => {
    const results = classifyPurchaseImportRows([row({ purchaseInvoiceNumber: '' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Purchase Invoice Number is required/);
  });

  it('rejects a row whose invoice number already exists in the database', () => {
    const state = baseState({ purchases: [purchase()] });
    const results = classifyPurchaseImportRows([row()], state);
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/already exists/);
  });

  it('rejects two rows in the same file using the same invoice number', () => {
    const results = classifyPurchaseImportRows(
      [row({ rowNumber: 2 }), row({ rowNumber: 3 })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[1].status).toBe('error');
    expect(results[1].errors[0]).toMatch(/used more than once in this file/);
  });

  it('rejects a row whose Vendor Name does not match any existing vendor', () => {
    const results = classifyPurchaseImportRows([row({ vendorName: 'Ghost Vendor' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing vendor/);
  });

  it('rejects a row whose Project Name does not match any existing project', () => {
    const results = classifyPurchaseImportRows([row({ projectName: 'Ghost Project' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/does not match any existing project/);
  });

  it('defaults a blank Purchase Category to Materials', () => {
    const results = classifyPurchaseImportRows([row({ purchaseCategory: '' })], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.purchaseCategory).toBe('Materials');
  });

  it('rejects an invalid Purchase Category', () => {
    const results = classifyPurchaseImportRows([row({ purchaseCategory: 'Groceries' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Purchase Category must be one of/);
  });

  it('accepts reverse_charge as a valid VAT Treatment', () => {
    const results = classifyPurchaseImportRows([row({ vatTreatment: 'reverse_charge' })], baseState());
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.vatTreatment).toBe('reverse_charge');
  });

  it('rejects an invalid VAT Treatment', () => {
    const results = classifyPurchaseImportRows([row({ vatTreatment: 'nonsense' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/VAT Treatment must be exactly/);
  });

  it('computes zero VAT for a zero_rated purchase regardless of the VAT Rate column', () => {
    const results = classifyPurchaseImportRows(
      [row({ vatTreatment: 'zero_rated', vatRate: '5', netAmount: '5000' })],
      baseState()
    );
    expect(results[0].status).toBe('new');
    expect(results[0].resolved?.vatAmount).toBe(0);
    expect(results[0].resolved?.grossAmount).toBeCloseTo(5000, 3);
  });

  it('rejects a non-positive Net Amount', () => {
    const results = classifyPurchaseImportRows([row({ netAmount: '0' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Net Amount must be a positive number/);
  });

  it('rejects a blank Document Ref', () => {
    const results = classifyPurchaseImportRows([row({ documentRef: '' })], baseState());
    expect(results[0].status).toBe('error');
    expect(results[0].errors[0]).toMatch(/Document Ref is required/);
  });
});
