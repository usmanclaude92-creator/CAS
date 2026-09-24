import { Vendor, Project, Purchase, VatTreatment } from '../types';
import { computeVatSplit } from './vat';

export interface PurchaseImportRawRow {
  rowNumber: number; // 1-based spreadsheet row number (header is row 1, so data starts at 2)
  purchaseInvoiceNumber: string;
  date: string;
  vendorName: string;
  projectName: string;
  purchaseCategory: string;
  description: string;
  netAmount: string;
  vatRate: string;
  vatTreatment: string;
  documentRef: string;
  remarks: string;
}

export interface PurchaseImportResolved {
  purchaseInvoiceNumber: string;
  date: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  purchaseCategory: string;
  description: string;
  netAmount: number;
  vatRate: number;
  vatTreatment: VatTreatment;
  vatAmount: number;
  grossAmount: number;
  documentRef: string;
  remarks?: string;
}

export type PurchaseImportRowStatus = 'new' | 'error';

export interface PurchaseImportRowResult {
  rowNumber: number;
  raw: PurchaseImportRawRow;
  status: PurchaseImportRowStatus;
  /** Blocking reasons — a non-empty list means this row (and therefore the whole file) cannot be imported as-is. */
  errors: string[];
  resolved?: PurchaseImportResolved;
}

export interface PurchaseImportState {
  vendors: Vendor[];
  projects: Project[];
  purchases: Purchase[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_VAT_TREATMENTS = new Set<string>(['standard', 'zero_rated', 'exempt', 'out_of_scope', 'reverse_charge']);
const VALID_CATEGORIES = new Set<string>(['materials', 'subcontractor', 'equipment', 'safety & consumables', 'other']);
const DEFAULT_CATEGORY = 'Materials';

/** Normalizes a parsed spreadsheet grid (header row + data rows) into raw import rows. */
export function parsePurchaseImportRows(rows: string[][]): PurchaseImportRawRow[] {
  if (rows.length <= 1) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keywords: string[]) => header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const purchaseInvoiceNumberIdx = findCol('purchaseinvoicenumber', 'invoicenumber');
  const dateIdx = findCol('date');
  const vendorIdx = findCol('vendorname', 'vendor');
  const projectIdx = findCol('projectname', 'project');
  const categoryIdx = findCol('purchasecategory', 'category');
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
      purchaseInvoiceNumber: col(cols, purchaseInvoiceNumberIdx),
      date: col(cols, dateIdx),
      vendorName: col(cols, vendorIdx),
      projectName: col(cols, projectIdx),
      purchaseCategory: col(cols, categoryIdx),
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
 * existing Purchases. Like the Client Invoice import, there is no 'update'
 * status here: the Purchase Invoice Number is the natural, unambiguous
 * duplicate key (enforced by the table's own UNIQUE constraint), so a
 * number that already exists — in the database or earlier in the same
 * file — is always a blocking error, never something to silently merge
 * into.
 */
export function classifyPurchaseImportRows(
  rawRows: PurchaseImportRawRow[],
  state: PurchaseImportState
): PurchaseImportRowResult[] {
  const results: PurchaseImportRowResult[] = [];

  const existingNumbers = new Set(state.purchases.map((p) => p.purchaseInvoiceNumber.toLowerCase()));
  const numbersSeenInFile = new Map<string, number>(); // lowercase number -> row number first seen

  for (const raw of rawRows) {
    const errors: string[] = [];

    const purchaseInvoiceNumber = raw.purchaseInvoiceNumber.trim();
    if (!purchaseInvoiceNumber) {
      errors.push('Purchase Invoice Number is required.');
    } else {
      const key = purchaseInvoiceNumber.toLowerCase();
      if (existingNumbers.has(key)) {
        errors.push(`Purchase invoice number "${purchaseInvoiceNumber}" already exists.`);
      } else if (numbersSeenInFile.has(key)) {
        errors.push(
          `Purchase invoice number "${purchaseInvoiceNumber}" is used more than once in this file (first seen on row ${numbersSeenInFile.get(key)}).`
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

    const vendorNameInput = raw.vendorName.trim();
    let vendor: Vendor | undefined;
    if (!vendorNameInput) {
      errors.push('Vendor Name is required.');
    } else {
      vendor = state.vendors.find((v) => v.name.toLowerCase() === vendorNameInput.toLowerCase());
      if (!vendor) errors.push(`Vendor "${vendorNameInput}" does not match any existing vendor.`);
    }

    const projectNameInput = raw.projectName.trim();
    let project: Project | undefined;
    if (!projectNameInput) {
      errors.push('Project Name is required.');
    } else {
      project = state.projects.find((p) => p.name.toLowerCase() === projectNameInput.toLowerCase());
      if (!project) errors.push(`Project "${projectNameInput}" does not match any existing project.`);
    }

    const categoryInput = raw.purchaseCategory.trim();
    let purchaseCategory = DEFAULT_CATEGORY;
    if (categoryInput) {
      if (!VALID_CATEGORIES.has(categoryInput.toLowerCase())) {
        errors.push('Purchase Category must be one of: Materials, Subcontractor, Equipment, Safety & Consumables, Other.');
      } else {
        purchaseCategory = categoryInput;
      }
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
      errors.push('VAT Treatment must be exactly "standard", "zero_rated", "exempt", "out_of_scope", or "reverse_charge".');
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

    const resolved: PurchaseImportResolved = {
      purchaseInvoiceNumber,
      date,
      vendorId: vendor!.id,
      vendorName: vendor!.name,
      projectId: project!.id,
      projectName: project!.name,
      purchaseCategory,
      description,
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
