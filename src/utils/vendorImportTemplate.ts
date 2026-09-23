import * as XLSX from 'xlsx';
import { Vendor } from '../types';

export interface VendorTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Vendor master-data column layout, shared by
// the import template download, the import parser, and the Vendors export —
// so all three stay in sync.
export const VENDOR_TEMPLATE_COLUMNS: VendorTemplateColumn[] = [
  { header: 'Code', key: 'code' },
  { header: 'Name', key: 'name' },
  { header: 'Category', key: 'category' },
  { header: 'Contact Person', key: 'contactPerson' },
  { header: 'Phone', key: 'phone' },
  { header: 'Email', key: 'email' },
  { header: 'Address', key: 'address' },
  { header: 'Opening Balance', key: 'openingBalance' },
  { header: 'Status', key: 'status' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = VENDOR_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadVendorImportTemplate() {
  const sampleRow = {
    Code: 'VND-005',
    Name: 'Muscat Cement Products',
    Category: 'Building Materials',
    'Contact Person': 'Salim Al Rashdi',
    Phone: '+968 99112233',
    Email: 'sales@muscatcement.om',
    Address: 'Rusayl Industrial Estate, Muscat, Oman',
    'Opening Balance': 3500,
    Status: 'active',
    Remarks: 'Optional notes',
  };

  const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendors Template');
  XLSX.writeFile(workbook, 'Vendor_Import_Template.xlsx', { bookType: 'xlsx' });
}

export function buildVendorExportRows(vendors: Vendor[]) {
  return vendors.map((v) => ({
    Code: v.code,
    Name: v.name,
    Category: v.category || '',
    'Contact Person': v.contactPerson || '',
    Phone: v.phone || '',
    Email: v.email || '',
    Address: v.address || '',
    'Opening Balance': v.openingBalance,
    Status: v.status,
    Remarks: v.remarks || '',
  }));
}
