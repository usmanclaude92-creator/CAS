import * as XLSX from 'xlsx';
import { Customer } from '../types';

export interface CustomerTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Customer master-data column layout, shared
// by the import template download, the import parser, and the Customers
// export — so all three stay in sync.
export const CUSTOMER_TEMPLATE_COLUMNS: CustomerTemplateColumn[] = [
  { header: 'Code', key: 'code' },
  { header: 'Name', key: 'name' },
  { header: 'VATIN', key: 'vatin' },
  { header: 'Contact Person', key: 'contactPerson' },
  { header: 'Phone', key: 'phone' },
  { header: 'Email', key: 'email' },
  { header: 'Address', key: 'address' },
  { header: 'Opening Balance', key: 'openingBalance' },
  { header: 'Status', key: 'status' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = CUSTOMER_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadCustomerImportTemplate() {
  const sampleRow = {
    Code: 'CUST-005',
    Name: 'Al Khuwair Towers LLC',
    VATIN: 'OM1234567890',
    'Contact Person': 'Ahmed Al Balushi',
    Phone: '+968 99887766',
    Email: 'towers@khuwair.om',
    Address: 'Al Khuwair, Muscat, Oman',
    'Opening Balance': 5000,
    Status: 'active',
    Remarks: 'Optional notes',
  };

  const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers Template');
  XLSX.writeFile(workbook, 'Customer_Import_Template.xlsx', { bookType: 'xlsx' });
}

export function buildCustomerExportRows(customers: Customer[]) {
  return customers.map((c) => ({
    Code: c.code,
    Name: c.name,
    VATIN: c.vatin || '',
    'Contact Person': c.contactPerson || '',
    Phone: c.phone || '',
    Email: c.email || '',
    Address: c.address || '',
    'Opening Balance': c.openingBalance,
    Status: c.status,
    Remarks: c.remarks || '',
  }));
}
