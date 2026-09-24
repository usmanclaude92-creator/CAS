import * as XLSX from 'xlsx';

export interface DirectExpenseTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Direct/Cash Expense import
// column layout, shared by the template download and the import parser/validator.
export const DIRECT_EXPENSE_TEMPLATE_COLUMNS: DirectExpenseTemplateColumn[] = [
  { header: 'Expense Date', key: 'expenseDate' },
  { header: 'Project', key: 'projectName' },
  { header: 'Expense Head', key: 'expenseHeadName' },
  { header: 'Description', key: 'description' },
  { header: 'Vendor Name', key: 'vendorName' },
  { header: 'Net Amount (OMR)', key: 'netAmount' },
  { header: 'VAT Rate (%)', key: 'vatRate' },
  { header: 'VAT Treatment', key: 'vatTreatment' },
  { header: 'Paid From', key: 'paidFrom' },
  { header: 'Account Name', key: 'accountName' },
  { header: 'Document Ref', key: 'documentRef' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = DIRECT_EXPENSE_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadDirectExpenseImportTemplate() {
  const sampleRows = [
    {
      'Expense Date': '2025-02-18',
      Project: 'Al Khuwair Towers',
      'Expense Head': 'Statutory Fees & Permits',
      Description: 'Site access permit renewal',
      'Vendor Name': 'Muscat Municipality',
      'Net Amount (OMR)': 120,
      'VAT Rate (%)': 0,
      'VAT Treatment': 'exempt',
      'Paid From': 'Petty Cash',
      'Account Name': 'Site Office Cash',
      'Document Ref': 'EXP-2025-0041',
      Remarks: '',
    },
    {
      'Expense Date': '2025-03-02',
      Project: 'Al Khuwair Towers',
      'Expense Head': 'Fuel & Transport',
      Description: 'Diesel for site generator',
      'Vendor Name': 'Al Maha Petroleum',
      'Net Amount (OMR)': 85,
      'VAT Rate (%)': 5,
      'VAT Treatment': 'standard',
      'Paid From': 'Cash',
      'Account Name': 'Head Office Cash Box',
      'Document Ref': '',
      Remarks: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Direct Expense Template');
  XLSX.writeFile(workbook, 'Direct_Expense_Import_Template.xlsx', { bookType: 'xlsx' });
}
