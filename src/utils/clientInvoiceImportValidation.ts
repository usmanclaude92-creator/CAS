import { Customer, Project, ClientInvoice, VatTreatment } from '../types';
import { computeVatSplit } from './vat';

export interface ClientInvoiceImportRawRow {
  rowNumber: number; // 1-based spreadsheet row number (header is row 1, so data starts at 2)
  invoiceType: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  projectName: string;
  description: string;
  netAmount: string;
  vatRate: string;
  vatTreatment: string;
  documentRef: string;
  remarks: string;
}

export interface ClientInvoiceImportResolved {
  invoiceType: 'IPC' | 'Invoice';
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  description?: string;
  netAmount: number;
  vatRate: number;
  vatTreatment: VatTreatment;
  vatAmount: number;
  grossAmount: number;
  documentRef: string;
  remarks?: string;
}

export type ClientInvoiceImportRowStatus = 'new' | 'error';

export interface ClientInvoiceImportRowResult {
  rowNumber: number;
  raw: ClientInvoiceImportRawRow;
  status: ClientInvoiceImportRowStatus;
  /** Blocking reasons — a non-empty list means this row (and therefore the whole file) cannot be imported as-is. */
  errors: string[];
  resolved?: ClientInvoiceImportResolved;
}

export interface ClientInvoiceImportState {
  customers: Customer[];
  projects: Project[];
  clientInvoices: ClientInvoice[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_VAT_TREATMENTS = new Set<string>(['standard', 'zero_rated', 'exempt', 'out_of_scope']);

/** Normalizes a parsed spreadsheet grid (header row + data rows) into raw import rows. */
export function parseClientInvoiceImportRows(rows: string[][]): ClientInvoiceImportRawRow[] {
  if (rows.length <= 1) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keywords: string[]) => header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const invoiceTypeIdx = findCol('invoicetype');
  const invoiceNumberIdx = findCol('invoicenumber');
  const dateIdx = findCol('date');
  const customerIdx = findCol('customername', 'customer');
  const projectIdx = findCol('projectname', 'project');
  const descriptionIdx = findCol('description');
  const netAmountIdx = findCol('netamount');
  const vatRateIdx = findCol('vatrate');
  const vatTreatmentIdx = findCol('vattreatment');
  const documentRefIdx = findCol('documentref');
  const remarksIdx = findCol('remarks', 'notes');

  const col = (cols: string[], idx: number) => (idx >= 0 ? (cols[idx] ?? '').trim() : '');

  return rows
    .slice(1)
    .map((cols, i) => ({ cols, rowNumber: i + 2 }))
    .filter(({ cols }) => cols.some((v) => v.trim()))
    .map(({ cols, rowNumber }) => ({
      rowNumber,
      invoiceType: col(cols, invoiceTypeIdx),
      invoiceNumber: col(cols, invoiceNumberIdx),
      date: col(cols, dateIdx),
      customerName: col(cols, customerIdx),
      projectName: col(cols, projectIdx),
      description: col(cols, descriptionIdx),
      netAmount: col(cols, netAmountIdx),
      vatRate: col(cols, vatRateIdx),
      vatTreatment: col(cols, vatTreatmentIdx),
      documentRef: col(cols, documentRefIdx),
      remarks: col(cols, remarksIdx),
    }));
}

/**
 * Validates and classifies every row against current master data and
 * existing Client Invoices. Unlike the Money In/Out imports, there is no
 * 'update' status here: this import preserves each row's own invoice
 * number (see import_client_invoice) rather than assigning a new one — so
 * the invoice number is the natural, unambiguous duplicate key. A number
 * that already exists (in the database or earlier in the same file) is
 * always a blocking error, never something to silently merge into.
 */
export function classifyClientInvoiceImportRows(
  rawRows: ClientInvoiceImportRawRow[],
  state: ClientInvoiceImportState
): ClientInvoiceImportRowResult[] {
  const results: ClientInvoiceImportRowResult[] = [];

  const existingNumbers = new Set(state.clientInvoices.map((i) => i.invoiceNumber.toLowerCase()));
  const numbersSeenInFile = new Map<string, number>(); // lowercase number -> row number first seen

  for (const raw of rawRows) {
    const errors: string[] = [];

    const invoiceTypeRaw = raw.invoiceType.trim();
    const invoiceType: 'IPC' | 'Invoice' | null =
      invoiceTypeRaw === 'IPC' ? 'IPC' : invoiceTypeRaw === 'Invoice' ? 'Invoice' : null;
    if (!invoiceType) errors.push('Invoice Type must be exactly "IPC" or "Invoice".');

    const invoiceNumber = raw.invoiceNumber.trim();
    if (!invoiceNumber) {
      errors.push('Invoice Number is required.');
    } else {
      const key = invoiceNumber.toLowerCase();
      if (existingNumbers.has(key)) {
        errors.push(`Invoice number "${invoiceNumber}" already exists.`);
      } else if (numbersSeenInFile.has(key)) {
        errors.push(
          `Invoice number "${invoiceNumber}" is used more than once in this file (first seen on row ${numbersSeenInFile.get(key)}).`
        );
      } else {
        numbersSeenInFile.set(key, raw.rowNumber);
      }
    }

    const date = raw.date.trim();
    if (!date) {
      errors.push('Date is required.');
    } else if (!DATE_PATTERN.test(date) || isNaN(Date.parse(date))) {
      errors.push('Date must be in YYYY-MM-DD format.');
    }

    const customerNameInput = raw.customerName.trim();
    let customer: Customer | undefined;
    if (!customerNameInput) {
      errors.push('Customer Name is required.');
    } else {
      customer = state.customers.find((c) => c.name.toLowerCase() === customerNameInput.toLowerCase());
      if (!customer) errors.push(`Customer "${customerNameInput}" does not match any existing customer.`);
    }

    const projectNameInput = raw.projectName.trim();
    let project: Project | undefined;
    if (!projectNameInput) {
      errors.push('Project Name is required.');
    } else {
      project = state.projects.find((p) => p.name.toLowerCase() === projectNameInput.toLowerCase());
      if (!project) errors.push(`Project "${projectNameInput}" does not match any existing project.`);
    }

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
      errors.push('VAT Treatment must be exactly "standard", "zero_rated", "exempt", or "out_of_scope".');
    }

    const documentRef = raw.documentRef.trim();
    if (!documentRef) errors.push('Document Ref is required.');

    if (errors.length > 0) {
      results.push({ rowNumber: raw.rowNumber, raw, status: 'error', errors });
      continue;
    }

    const description = raw.description.trim();
    const remarks = raw.remarks.trim();
    const vat = computeVatSplit(netAmount, vatRate, vatTreatment!);

    const resolved: ClientInvoiceImportResolved = {
      invoiceType: invoiceType!,
      invoiceNumber,
      date,
      customerId: customer!.id,
      customerName: customer!.name,
      projectId: project!.id,
      projectName: project!.name,
      description: description || undefined,
      netAmount: vat.netAmount,
      vatRate: vat.vatRate,
      vatTreatment: vat.vatTreatment,
      vatAmount: vat.vatAmount,
      grossAmount: vat.grossAmount,
      documentRef,
      remarks: remarks || undefined,
    };

    results.push({ rowNumber: raw.rowNumber, raw, status: 'new', errors: [], resolved });
  }

  return results;
}
