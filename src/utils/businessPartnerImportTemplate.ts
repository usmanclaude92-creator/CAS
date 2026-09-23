import * as XLSX from 'xlsx';
import { BusinessPartner } from '../types';

export interface BusinessPartnerTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Business Partner master-data column layout,
// shared by the import template download, the import parser, and any export.
export const BUSINESS_PARTNER_TEMPLATE_COLUMNS: BusinessPartnerTemplateColumn[] = [
  { header: 'Code', key: 'code' },
  { header: 'Name', key: 'name' },
  { header: 'Partner Type', key: 'partnerType' },
  { header: 'Contact Person', key: 'contactPerson' },
  { header: 'Phone', key: 'phone' },
  { header: 'Email', key: 'email' },
  { header: 'Address', key: 'address' },
  { header: 'Opening Balance', key: 'openingBalance' },
  { header: 'Status', key: 'status' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = BUSINESS_PARTNER_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadBusinessPartnerImportTemplate() {
  const sampleRow = {
    Code: 'BP-005',
    Name: 'Ahmed Al Balushi',
    'Partner Type': 'Director/Shareholder',
    'Contact Person': 'Ahmed Al Balushi',
    Phone: '+968 99112233',
    Email: 'ahmed@example.com',
    Address: 'Al Khuwair, Muscat, Oman',
    'Opening Balance': 0,
    Status: 'active',
    Remarks: 'Optional notes',
  };

  const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Business Partners Template');
  XLSX.writeFile(workbook, 'Business_Partner_Import_Template.xlsx', { bookType: 'xlsx' });
}

export function buildBusinessPartnerExportRows(partners: BusinessPartner[]) {
  return partners.map((p) => ({
    Code: p.code,
    Name: p.name,
    'Partner Type': p.partnerType,
    'Contact Person': p.contactPerson || '',
    Phone: p.phone || '',
    Email: p.email || '',
    Address: p.address || '',
    'Opening Balance': p.openingBalance,
    Status: p.status,
    Remarks: p.remarks || '',
  }));
}
