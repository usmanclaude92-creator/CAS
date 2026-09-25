import * as XLSX from 'xlsx';

export interface MoneyOutTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Money Out import column layout,
// shared by the template download and the import parser/validator.
export const MONEY_OUT_TEMPLATE_COLUMNS: MoneyOutTemplateColumn[] = [
  { header: 'Transaction Date', key: 'transactionDate' },
  { header: 'Project', key: 'projectName' },
  { header: 'Vendor Name', key: 'vendorName' },
  { header: 'Paid To', key: 'paidTo' },
  { header: 'Payment For', key: 'paymentFor' },
  { header: 'Purchase Invoice Number', key: 'purchaseInvoiceNumber' },
  { header: 'Expense Head', key: 'expenseHeadName' },
  { header: 'Amount (OMR)', key: 'amount' },
  { header: 'Paid From', key: 'paidFrom' },
  { header: 'Account Name', key: 'accountName' },
  { header: 'Document Ref / Payment Ref No.', key: 'documentRef' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = MONEY_OUT_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadMoneyOutImportTemplate() {
  const sampleRows = [
    {
      'Transaction Date': '2025-03-20',
      Project: 'Al Khuwair Towers',
      'Vendor Name': 'Muscat Cement Products',
      'Paid To': 'Muscat Cement Products - Bank Transfer',
      'Payment For': 'Purchase',
      'Purchase Invoice Number': 'PINV-2025-011',
      'Expense Head': '',
      'Amount (OMR)': 8000,
      'Paid From': 'Bank',
      'Account Name': 'Bank Muscat - Current Account',
      'Document Ref / Payment Ref No.': 'PAY-2041',
      Remarks: 'Second progress payment',
    },
    {
      'Transaction Date': '2025-04-05',
      Project: 'Al Khuwair Towers',
      'Vendor Name': '',
      'Paid To': 'Muscat Municipality - Site Permit Fee',
      'Payment For': 'Expense',
      'Purchase Invoice Number': '',
      'Expense Head': 'Statutory Fees & Permits',
      'Amount (OMR)': 350,
      'Paid From': 'Cash',
      'Account Name': 'Site Office Cash',
      'Document Ref / Payment Ref No.': '',
      Remarks: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment to Vendors Template');
  XLSX.writeFile(workbook, 'Payment_to_Vendors_Import_Template.xlsx', { bookType: 'xlsx' });
}
