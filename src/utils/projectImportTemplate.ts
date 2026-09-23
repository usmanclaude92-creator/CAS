import * as XLSX from 'xlsx';
import { Project, Customer } from '../types';

export interface ProjectTemplateColumn {
  header: string;
  key: string;
}

// Single source of truth for the Project master-data column layout, shared by
// the import template download, the import parser, and the Projects export —
// so all three stay in sync.
export const PROJECT_TEMPLATE_COLUMNS: ProjectTemplateColumn[] = [
  { header: 'Code', key: 'code' },
  { header: 'Name', key: 'name' },
  { header: 'Customer Code', key: 'customerCode' },
  { header: 'Customer Name', key: 'customerName' },
  { header: 'Contract Value', key: 'contractValue' },
  { header: 'Budget Cost', key: 'budgetCost' },
  { header: 'Start Date', key: 'startDate' },
  { header: 'End Date', key: 'endDate' },
  { header: 'Status', key: 'status' },
  { header: 'Remarks', key: 'remarks' },
];

const HEADERS = PROJECT_TEMPLATE_COLUMNS.map((c) => c.header);

export function downloadProjectImportTemplate() {
  const sampleRow = {
    Code: 'PRJ-005',
    Name: 'Al Khuwair Residential Tower',
    'Customer Code': 'CUST-001',
    'Customer Name': 'Al Khuwair Towers LLC',
    'Contract Value': 250000,
    'Budget Cost': 210000,
    'Start Date': '2026-01-15',
    'End Date': '2027-06-30',
    Status: 'active',
    Remarks: 'Optional notes',
  };

  const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: HEADERS });
  worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects Template');
  XLSX.writeFile(workbook, 'Project_Import_Template.xlsx', { bookType: 'xlsx' });
}

export function buildProjectExportRows(projects: Project[], customers: Customer[]) {
  const customerById = new Map(customers.map((c) => [c.id, c]));
  return projects.map((p) => {
    const customer = customerById.get(p.customerId);
    return {
      Code: p.code,
      Name: p.name,
      'Customer Code': customer?.code || '',
      'Customer Name': p.customerName || customer?.name || '',
      'Contract Value': p.contractValue,
      'Budget Cost': p.budgetCost ?? '',
      'Start Date': p.startDate,
      'End Date': p.endDate || '',
      Status: p.status,
      Remarks: p.remarks || '',
    };
  });
}
