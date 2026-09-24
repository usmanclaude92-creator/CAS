import * as XLSX from 'xlsx';

export interface TransferTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Bank/Cash Transfer import column layout,
// shared by the template download and the import parser/validator.
export const TRANSFER_TEMPLATE_COLUMNS: TransferTemplateColumn[] = [
  { header: 'Date', key: 'date' },
  { header: 'Transfer From Type', key: 'transferFromType' },
  { header: 'Transfer From Account', key: 'transferFromAccount' },
  { header: 'Transfer To Type', key: 'transferToType' },
  { header: 'Transfer To Account', key: 'transferToAccount' },
  { header: 'Amount (OMR)', key: 'amount' },
  { header: 'Document Ref', key: 'documentRef' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = TRANSFER_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadTransferImportTemplate() {
  const sampleRows = [
    {
      Date: '2024-10-12',
      'Transfer From Type': 'Bank',
      'Transfer From Account': 'Bank Muscat - Current Account',
      'Transfer To Type': 'Petty Cash',
      'Transfer To Account': 'Site Office Petty Cash',
      'Amount (OMR)': 500,
      'Document Ref': 'TRF-2024-014',
      Remarks: 'Weekly site float replenishment',
    },
    {
      Date: '2024-11-03',
      'Transfer From Type': 'Cash',
      'Transfer From Account': 'Cash in Hand - Head Office',
      'Transfer To Type': 'Bank',
      'Transfer To Account': 'Bank Muscat - Current Account',
      'Amount (OMR)': 1200,
      'Document Ref': 'TRF-2024-021',
      Remarks: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 22) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transfer Import Template');
  XLSX.writeFile(workbook, 'Transfer_Import_Template.xlsx', { bookType: 'xlsx' });
}
