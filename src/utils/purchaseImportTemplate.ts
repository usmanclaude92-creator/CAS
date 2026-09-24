import * as XLSX from 'xlsx';

export interface PurchaseTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Vendor Invoice / Purchase import column
// layout, shared by the template download and the import parser/validator.
export const PURCHASE_TEMPLATE_COLUMNS: PurchaseTemplateColumn[] = [
  { header: 'Purchase Invoice Number', key: 'purchaseInvoiceNumber' },
  { header: 'Date', key: 'date' },
  { header: 'Vendor Name', key: 'vendorName' },
  { header: 'Project Name', key: 'projectName' },
  { header: 'Purchase Category', key: 'purchaseCategory' },
  { header: 'Description', key: 'description' },
  { header: 'Net Amount (OMR)', key: 'netAmount' },
  { header: 'VAT Rate (%)', key: 'vatRate' },
  { header: 'VAT Treatment', key: 'vatTreatment' },
  { header: 'Document Ref', key: 'documentRef' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = PURCHASE_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadPurchaseImportTemplate() {
  const sampleRows = [
    {
      'Purchase Invoice Number': 'PINV-2024-088',
      Date: '2024-10-05',
      'Vendor Name': 'Muscat Cement Products',
      'Project Name': 'Al Khuwair Towers',
      'Purchase Category': 'Materials',
      Description: 'Cement supply for foundation works',
      'Net Amount (OMR)': 12000,
      'VAT Rate (%)': 5,
      'VAT Treatment': 'standard',
      'Document Ref': 'DOC-PINV-88-2024',
      Remarks: '',
    },
    {
      'Purchase Invoice Number': 'PINV-2024-091',
      Date: '2024-10-18',
      'Vendor Name': 'Muscat Cement Products',
      'Project Name': 'Al Khuwair Towers',
      'Purchase Category': 'Equipment',
      Description: 'Crane rental — 2 weeks',
      'Net Amount (OMR)': 3500,
      'VAT Rate (%)': 5,
      'VAT Treatment': 'reverse_charge',
      'Document Ref': 'DOC-PINV-91-2024',
      Remarks: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 20) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Import Template');
  XLSX.writeFile(workbook, 'Purchase_Import_Template.xlsx', { bookType: 'xlsx' });
}
