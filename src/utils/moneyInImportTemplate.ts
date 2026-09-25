import * as XLSX from 'xlsx';

export interface MoneyInTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Money In import column layout,
// shared by the template download and the import parser/validator.
export const MONEY_IN_TEMPLATE_COLUMNS: MoneyInTemplateColumn[] = [
  { header: 'Transaction Date', key: 'transactionDate' },
  { header: 'Project', key: 'projectName' },
  { header: 'Customer Name', key: 'customerName' },
  { header: 'Received From', key: 'receivedFrom' },
  { header: 'Against', key: 'against' },
  { header: 'Invoice / IPC Number', key: 'invoiceNumber' },
  { header: 'Amount (OMR)', key: 'amount' },
  { header: 'Received Into', key: 'receivedInto' },
  { header: 'Account Name', key: 'accountName' },
  { header: 'Document Ref / Receipt No.', key: 'documentRef' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = MONEY_IN_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadMoneyInImportTemplate() {
  const sampleRows = [
    {
      'Transaction Date': '2025-03-15',
      Project: 'Al Khuwair Towers',
      'Customer Name': 'Al Khuwair Towers LLC',
      'Received From': 'Al Khuwair Towers LLC - Bank Transfer',
      Against: 'Invoice',
      'Invoice / IPC Number': 'IPC-2025-003',
      'Amount (OMR)': 15000,
      'Received Into': 'Bank',
      'Account Name': 'Bank Muscat - Current Account',
      'Document Ref / Receipt No.': 'RCPT-1042',
      Remarks: 'Third IPC settlement',
    },
    {
      'Transaction Date': '2025-04-02',
      Project: 'Al Khuwair Towers',
      'Customer Name': '',
      'Received From': 'Petty cash reimbursement return',
      Against: 'Other',
      'Invoice / IPC Number': '',
      'Amount (OMR)': 250,
      'Received Into': 'Cash',
      'Account Name': 'Site Office Cash',
      'Document Ref / Receipt No.': '',
      Remarks: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Receipt from Client Template');
  XLSX.writeFile(workbook, 'Receipt_from_Client_Import_Template.xlsx', { bookType: 'xlsx' });
}
