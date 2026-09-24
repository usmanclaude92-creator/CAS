import * as XLSX from 'xlsx';

export interface ClientInvoiceTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Client Invoice / IPC import column layout,
// shared by the template download and the import parser/validator.
export const CLIENT_INVOICE_TEMPLATE_COLUMNS: ClientInvoiceTemplateColumn[] = [
  { header: 'Invoice Type', key: 'invoiceType' },
  { header: 'Invoice Number', key: 'invoiceNumber' },
  { header: 'Date', key: 'date' },
  { header: 'Customer Name', key: 'customerName' },
  { header: 'Project Name', key: 'projectName' },
  { header: 'Description', key: 'description' },
  { header: 'Net Amount (OMR)', key: 'netAmount' },
  { header: 'VAT Rate (%)', key: 'vatRate' },
  { header: 'VAT Treatment', key: 'vatTreatment' },
  { header: 'Document Ref', key: 'documentRef' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = CLIENT_INVOICE_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadClientInvoiceImportTemplate() {
  const sampleRows = [
    {
      'Invoice Type': 'IPC',
      'Invoice Number': 'IPC-2024-014',
      Date: '2024-11-10',
      'Customer Name': 'Al Khuwair Towers LLC',
      'Project Name': 'Al Khuwair Towers',
      Description: 'Interim Payment Certificate No. 14',
      'Net Amount (OMR)': 20000,
      'VAT Rate (%)': 5,
      'VAT Treatment': 'standard',
      'Document Ref': 'DOC-IPC-14-2024',
      Remarks: '',
    },
    {
      'Invoice Type': 'Invoice',
      'Invoice Number': 'INV-2024-102',
      Date: '2024-12-01',
      'Customer Name': 'Al Khuwair Towers LLC',
      'Project Name': 'Al Khuwair Towers',
      Description: 'Export of services — zero-rated',
      'Net Amount (OMR)': 5000,
      'VAT Rate (%)': 0,
      'VAT Treatment': 'zero_rated',
      'Document Ref': 'DOC-INV-102-2024',
      Remarks: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 20) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice Import Template');
  XLSX.writeFile(workbook, 'Client_Invoice_Import_Template.xlsx', { bookType: 'xlsx' });
}
