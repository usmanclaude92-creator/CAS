import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { accountingService } from './accountingService';
import { authService } from './authService';
import { formatOMR } from '../utils/formatters';
import { NavView } from '../components/Sidebar';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number; // character width for Excel
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row?: any) => string | number;
}

export interface ExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  sheetName?: string;
  data: any[];
  columns: ExportColumn[];
  orientation?: 'portrait' | 'landscape';
  summaryTotals?: Record<string, string | number>;
  companyName?: string;
}

/**
 * Trigger browser file download from Blob
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV format with UTF-8 BOM encoding for Excel compatibility
 */
export function exportToCsv(options: ExportOptions): void {
  const { filename, columns, data } = options;
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  // UTF-8 BOM ensures proper character decoding in Excel
  let csvContent = '\uFEFF';

  // Header row
  const headerLine = columns
    .map((col) => {
      const escaped = col.header.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(',');
  csvContent += headerLine + '\r\n';

  // Data rows
  data.forEach((row) => {
    const rowLine = columns
      .map((col) => {
        const rawVal = row[col.key];
        const val = col.format ? col.format(rawVal, row) : rawVal ?? '';
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(',');
    csvContent += rowLine + '\r\n';
  });

  // Summary row if present
  if (options.summaryTotals) {
    const summaryLine = columns
      .map((col) => {
        const val = options.summaryTotals![col.key] ?? '';
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(',');
    csvContent += summaryLine + '\r\n';
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, cleanFilename);
}

/**
 * Export data to Excel (.xlsx) workbook
 */
export function exportToExcel(options: ExportOptions): void {
  const { filename, sheetName = 'Report', columns, data } = options;
  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  // Build rows object
  const rows = data.map((item) => {
    const rowObj: Record<string, any> = {};
    columns.forEach((col) => {
      const rawVal = item[col.key];
      rowObj[col.header] = col.format ? col.format(rawVal, item) : rawVal ?? '';
    });
    return rowObj;
  });

  // Append summary row if available
  if (options.summaryTotals && rows.length > 0) {
    const summaryObj: Record<string, any> = {};
    columns.forEach((col) => {
      summaryObj[col.header] = options.summaryTotals![col.key] ?? '';
    });
    rows.push(summaryObj);
  }

  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);

  // Set explicit column widths
  worksheet['!cols'] = columns.map((col) => ({
    wch: col.width || Math.max(col.header.length + 4, 15),
  }));

  const workbook = XLSX.utils.book_new();
  const safeSheetName = sheetName.replace(/[:\\/?*\[\]]/g, '').substring(0, 31) || 'Report';
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

  XLSX.writeFile(workbook, cleanFilename, { bookType: 'xlsx' });
}

/**
 * Export data to structured, professional PDF document
 */
export function exportToPdf(options: ExportOptions): void {
  const {
    filename,
    title,
    subtitle,
    columns,
    data,
    companyName = 'Artify Construction Accounting System',
    orientation,
    summaryTotals,
  } = options;

  // Choose landscape if more than 5 columns for readability
  const pageOrientation: 'portrait' | 'landscape' =
    orientation || (columns.length > 5 ? 'landscape' : 'portrait');

  const doc = new jsPDF({
    orientation: pageOrientation,
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Accent gradient line (cyan-to-blue)
  doc.setFillColor(0, 210, 255); // neon cyan
  doc.rect(0, 42, pageWidth, 2.5, 'F');

  // Company Brand in Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(companyName.toUpperCase(), 30, 26);

  // Export Timestamp in Header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`EXPORT GENERATED: ${timestamp.toUpperCase()}`, pageWidth - 30, 26, { align: 'right' });

  // Document Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(title, 30, 68);

  let startY = 74;
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(subtitle, 30, 83);
    startY = 92;
  } else {
    startY = 80;
  }

  // Column style map for alignment
  const columnStyles: Record<number, any> = {};
  columns.forEach((col, idx) => {
    columnStyles[idx] = {
      halign: col.align || (col.key.toLowerCase().includes('amount') || col.key.toLowerCase().includes('balance') || col.key.toLowerCase().includes('value') || col.key.toLowerCase().includes('cost') || col.key.toLowerCase().includes('invoiced') || col.key.toLowerCase().includes('paid') || col.key.toLowerCase().includes('received') ? 'right' : 'left'),
    };
  });

  // Table Body Rows
  const tableBody = data.map((item) =>
    columns.map((col) => {
      const rawVal = item[col.key];
      const formatted = col.format ? col.format(rawVal, item) : rawVal ?? '';
      return String(formatted);
    })
  );

  // Table Footer Row (if summary totals provided)
  const tableFoot = summaryTotals
    ? [
        columns.map((col) => {
          const val = summaryTotals[col.key];
          return val !== undefined ? String(val) : '';
        }),
      ]
    : undefined;

  // Generate table using autoTable
  autoTable(doc, {
    startY: startY,
    margin: { left: 30, right: 30, top: 50, bottom: 40 },
    head: [columns.map((c) => c.header)],
    body: tableBody.length > 0 ? tableBody : [[ 'No records found matching criteria', ...Array(columns.length - 1).fill('') ]],
    foot: tableFoot,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [30, 41, 59], // slate-800
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.5,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    footStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: [203, 213, 225],
    },
    columnStyles: columnStyles,
    didDrawPage: (data) => {
      // Footer with page numbering
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400

      // Left footer
      doc.text(
        'Artify Construction Accounting System &bull; Confidential Financial Records',
        30,
        pageHeight - 16
      );

      // Right footer: Page X of Y
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - 30, pageHeight - 16, {
        align: 'right',
      });
    },
  });

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(cleanFilename);
}

/**
 * Universal export function supporting CSV, Excel, and PDF
 */
export function exportData(format: ExportFormat, options: ExportOptions): void {
  switch (format) {
    case 'csv':
      exportToCsv(options);
      break;
    case 'xlsx':
      exportToExcel(options);
      break;
    case 'pdf':
      exportToPdf(options);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Resolves current table data, columns, and metadata visible in the active view
 */
export function getActiveViewExportData(
  activeView: NavView,
  context?: {
    projectId?: string | null;
    customerId?: string | null;
    vendorId?: string | null;
    accountId?: string | null;
    activeTab?: string | null;
  }
): ExportOptions {
  const state = accountingService.getState();
  const dateStamp = new Date().toISOString().split('T')[0];

  switch (activeView) {
    case 'dashboard': {
      const allTx = accountingService.getAllTransactions();
      const recentTx = allTx.slice(0, 100);

      const totalAmount = recentTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);

      return {
        filename: `Artify_Dashboard_Transactions_${dateStamp}`,
        title: 'Executive Financial Dashboard - Recent Transactions',
        subtitle: `Showing ${recentTx.length} latest transactions across all active construction projects`,
        sheetName: 'Recent Transactions',
        data: recentTx,
        columns: [
          { header: 'Tx Date', key: 'date', width: 14 },
          { header: 'Doc / Ref #', key: 'documentRef', width: 18 },
          { header: 'Type', key: 'type', width: 16 },
          { header: 'Project', key: 'projectName', width: 24 },
          { header: 'Party / Beneficiary', key: 'customerName', width: 22, format: (val, row) => row.customerName || row.vendorName || row.partyName || '-' },
          { header: 'Account', key: 'accountName', width: 20 },
          { header: 'Amount (OMR)', key: 'amount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Status', key: 'status', width: 14, align: 'center' },
        ],
        summaryTotals: {
          date: 'TOTAL',
          amount: formatOMR(totalAmount),
        },
      };
    }

    case 'projects':
    case 'project_dashboard': {
      // If a specific project is selected, export its ledger and financials
      if (context?.projectId) {
        const project = state.projects.find((p) => p.id === context.projectId);
        const profitability = accountingService.getProjectProfitability(context.projectId);
        const projectLedger = accountingService.getProjectLedger(context.projectId);

        return {
          filename: `Artify_Project_${project?.code || 'Detail'}_Ledger_${dateStamp}`,
          title: `Project Ledger: ${project?.code || ''} - ${project?.name || 'Selected Project'}`,
          subtitle: `Client: ${project?.customerName || 'N/A'} | Contract Value: ${formatOMR(profitability.contractValue)} | Gross Profit: ${formatOMR(profitability.grossProfit)} (${profitability.profitMarginPercent.toFixed(1)}%)`,
          sheetName: `${project?.code || 'Project'} Ledger`,
          data: projectLedger,
          columns: [
            { header: 'Date', key: 'date', width: 14 },
            { header: 'Ref #', key: 'documentRef', width: 18 },
            { header: 'Type', key: 'type', width: 16 },
            { header: 'Description', key: 'description', width: 28 },
            { header: 'Revenue (OMR)', key: 'revenue', width: 16, align: 'right', format: (val) => formatOMR(val) },
            { header: 'Cost (OMR)', key: 'cost', width: 16, align: 'right', format: (val) => formatOMR(val) },
            { header: 'Running Profit (OMR)', key: 'runningProfit', width: 18, align: 'right', format: (val) => formatOMR(val) },
          ],
        };
      }

      // Default: All Projects Profitability Summary
      const allProjects = accountingService.getAllProjectProfitabilities();
      const totalContract = allProjects.reduce((sum, p) => sum + p.contractValue, 0);
      const totalInvoiced = allProjects.reduce((sum, p) => sum + p.totalInvoiced, 0);
      const totalCost = allProjects.reduce((sum, p) => sum + p.totalProjectCost, 0);
      const totalGrossProfit = allProjects.reduce((sum, p) => sum + p.grossProfit, 0);

      return {
        filename: `Artify_Projects_Summary_${dateStamp}`,
        title: 'Construction Projects Performance & Profitability Master Register',
        subtitle: `Consolidated financial tracking of all active, pending, and completed projects`,
        sheetName: 'Projects Summary',
        data: allProjects,
        columns: [
          { header: 'Project Code', key: 'projectCode', width: 16 },
          { header: 'Project Name', key: 'projectName', width: 28 },
          { header: 'Client / Customer', key: 'customerName', width: 24 },
          { header: 'Contract Value', key: 'contractValue', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Invoiced (OMR)', key: 'totalInvoiced', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Received (OMR)', key: 'totalReceived', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Project Cost (OMR)', key: 'totalProjectCost', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Gross Profit (OMR)', key: 'grossProfit', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Margin %', key: 'profitMarginPercent', width: 14, align: 'center', format: (val) => `${Number(val || 0).toFixed(1)}%` },
        ],
        summaryTotals: {
          projectCode: 'CONSOLIDATED TOTALS',
          contractValue: formatOMR(totalContract),
          totalInvoiced: formatOMR(totalInvoiced),
          totalProjectCost: formatOMR(totalCost),
          grossProfit: formatOMR(totalGrossProfit),
        },
      };
    }

    case 'approvals': {
      const allTx = accountingService.getAllTransactions();
      const approvalRecords = allTx.filter(
        (tx) => tx.status === 'submitted' || tx.status === 'draft' || tx.status === 'approved'
      );
      const totalAmount = approvalRecords.reduce((sum, tx) => sum + (tx.amount || 0), 0);

      return {
        filename: `Artify_Approvals_Workflow_${dateStamp}`,
        title: 'Financial Approvals & Multi-Tier Workflow Queue',
        subtitle: `Audit record of transactions awaiting verification, approval, or posting`,
        sheetName: 'Approval Queue',
        data: approvalRecords,
        columns: [
          { header: 'Doc Ref #', key: 'documentRef', width: 18 },
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Transaction Type', key: 'type', width: 18 },
          { header: 'Project', key: 'projectName', width: 24 },
          { header: 'Party / Payee', key: 'customerName', width: 22, format: (val, row) => row.customerName || row.vendorName || '-' },
          { header: 'Initiated By', key: 'createdByName', width: 18, format: (val, row) => row.createdByName || row.submittedBy || 'System' },
          { header: 'Amount (OMR)', key: 'amount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Workflow Status', key: 'status', width: 16, align: 'center' },
        ],
        summaryTotals: {
          documentRef: 'TOTAL QUEUE VALUE',
          amount: formatOMR(totalAmount),
        },
      };
    }

    case 'banking': {
      const activeAccId = context?.accountId || accountingService.getActiveTreasuryAccountId();
      const targetAccountId = activeAccId !== 'all' ? activeAccId : undefined;

      if (context?.activeTab === 'transfers') {
        const transfers = state.transfers || [];
        const totalTransferAmount = transfers.reduce((sum, tr) => sum + (tr.amount || 0), 0);

        return {
          filename: `Artify_Internal_Transfers_${dateStamp}`,
          title: 'Banking & Treasury Operations - Internal Transfers Register',
          subtitle: `Internal transfers between corporate bank accounts, cash vaults, and site floats`,
          sheetName: 'Internal Transfers',
          data: transfers,
          columns: [
            { header: 'DATE', key: 'date', width: 14 },
            { header: 'DOC REF', key: 'documentRef', width: 16 },
            {
              header: 'TRANSFER FROM',
              key: 'transferFromName',
              width: 24,
              format: (val, row) => `${row.transferFromName} (${(row.transferFromType || '').replace('_', ' ')})`,
            },
            {
              header: 'TRANSFER TO',
              key: 'transferToName',
              width: 24,
              format: (val, row) => `${row.transferToName} (${(row.transferToType || '').replace('_', ' ')})`,
            },
            {
              header: 'AMOUNT',
              key: 'amount',
              width: 18,
              align: 'right',
              format: (val) => formatOMR(val || 0),
            },
            { header: 'REMARKS', key: 'remarks', width: 28, format: (val) => val || '—' },
            {
              header: 'ATTACHMENT',
              key: 'attachmentUrl',
              width: 16,
              align: 'center',
              format: (val) => (val ? 'Attachment Available' : '—'),
            },
          ],
          summaryTotals: {
            transferFromName: 'TOTAL TRANSFERS',
            amount: formatOMR(totalTransferAmount),
          },
        };
      }

      // Default: Bank & Cash Book Ledger matching the exact table format on screen
      const ledger = accountingService.getTreasuryLedger(targetAccountId);

      const totalReceipts = ledger.reduce((sum, r) => sum + (r.receipt || 0), 0);
      const totalPayments = ledger.reduce((sum, r) => sum + (r.payment || 0), 0);
      const finalBalance = ledger.length > 0 ? (ledger[ledger.length - 1].runningBalance ?? 0) : 0;

      const accountObj = targetAccountId
        ? state.bankAccounts.find((b) => b.id === targetAccountId) ||
          state.cashAccounts.find((c) => c.id === targetAccountId) ||
          state.pettyCashAccounts.find((p) => p.id === targetAccountId)
        : null;

      const accountSubtitle = accountObj
        ? `Account: ${accountObj.accountName} (${(accountObj as any).bankName || (accountObj as any).accountType || 'Treasury'}) • Current Balance: ${formatOMR(accountObj.currentBalance)}`
        : 'All Commercial Bank Accounts, Cash in Hand, and Site Petty Cash Accounts';

      return {
        filename: `Artify_Bank_Cash_Book_${dateStamp}`,
        title: 'Banking & Treasury Operations - Bank & Cash Book Ledger',
        subtitle: accountSubtitle,
        sheetName: 'Bank & Cash Book',
        data: ledger,
        columns: [
          { header: 'DATE', key: 'date', width: 14 },
          { header: 'DOC REF', key: 'documentRef', width: 16 },
          { header: 'ACCOUNT', key: 'accountName', width: 22 },
          { header: 'TYPE', key: 'type', width: 16 },
          {
            header: 'PARTY / DETAIL',
            key: 'party',
            width: 22,
            format: (val, row) => row.party || row.partyName || '—',
          },
          { header: 'DESCRIPTION', key: 'description', width: 34 },
          {
            header: 'RECEIPT (DR)',
            key: 'receipt',
            width: 16,
            align: 'right',
            format: (val) => (val && val > 0 ? formatOMR(val) : '—'),
          },
          {
            header: 'PAYMENT (CR)',
            key: 'payment',
            width: 16,
            align: 'right',
            format: (val) => (val && val > 0 ? formatOMR(val) : '—'),
          },
          {
            header: 'RUNNING BALANCE',
            key: 'runningBalance',
            width: 18,
            align: 'right',
            format: (val) => formatOMR(val ?? 0),
          },
        ],
        summaryTotals: {
          accountName: 'TOTALS',
          receipt: formatOMR(totalReceipts),
          payment: formatOMR(totalPayments),
          runningBalance: formatOMR(finalBalance),
        },
      };
    }

    case 'customers': {
      // Calculate customer balances
      const customerSummaries = state.customers.map((c) => {
        const invoices = state.clientInvoices.filter((inv) => inv.customerId === c.id);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
        const totalReceived = invoices.reduce((sum, inv) => sum + inv.receivedAmount, 0);
        const outstanding = totalInvoiced - totalReceived;

        return {
          code: c.code,
          name: c.name,
          contactPerson: c.contactPerson || '-',
          phone: c.phone || '-',
          email: c.email || '-',
          openingBalance: c.openingBalance || 0,
          totalInvoiced,
          totalReceived,
          outstanding,
          status: c.status,
        };
      });

      const totalReceivables = customerSummaries.reduce((sum, c) => sum + c.outstanding, 0);

      return {
        filename: `Artify_Customers_Receivables_${dateStamp}`,
        title: 'Clients & Accounts Receivable Master Ledger',
        subtitle: `Client billing summaries, total receipts collected, and pending invoice balances`,
        sheetName: 'Customers Receivables',
        data: customerSummaries,
        columns: [
          { header: 'Client Code', key: 'code', width: 14 },
          { header: 'Company / Client Name', key: 'name', width: 26 },
          { header: 'Contact Person', key: 'contactPerson', width: 20 },
          { header: 'Phone', key: 'phone', width: 16 },
          { header: 'Total Invoiced (OMR)', key: 'totalInvoiced', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Collected (OMR)', key: 'totalReceived', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Outstanding Due (OMR)', key: 'outstanding', width: 18, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Status', key: 'status', width: 12, align: 'center' },
        ],
        summaryTotals: {
          code: 'TOTAL RECEIVABLES',
          outstanding: formatOMR(totalReceivables),
        },
      };
    }

    case 'purchases': {
      const purchases = state.purchases || [];
      const totalBills = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
      const totalOutstanding = purchases.reduce((sum, p) => sum + p.outstandingAmount, 0);

      return {
        filename: `Artify_Vendor_Purchases_${dateStamp}`,
        title: 'Vendor Purchases & Accounts Payable Register',
        subtitle: `Material bills, subcontractor invoices, and supplier settlement tracking`,
        sheetName: 'Vendor Purchases',
        data: purchases,
        columns: [
          { header: 'Bill / Invoice #', key: 'purchaseInvoiceNumber', width: 18 },
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Vendor / Supplier', key: 'vendorName', width: 24 },
          { header: 'Project', key: 'projectName', width: 24 },
          { header: 'Category', key: 'purchaseCategory', width: 18 },
          { header: 'Total Bill (OMR)', key: 'amount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Paid (OMR)', key: 'paidAmount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Balance Due (OMR)', key: 'outstandingAmount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Status', key: 'status', width: 14, align: 'center' },
        ],
        summaryTotals: {
          purchaseInvoiceNumber: 'TOTALS',
          amount: formatOMR(totalBills),
          paidAmount: formatOMR(totalPaid),
          outstandingAmount: formatOMR(totalOutstanding),
        },
      };
    }

    case 'expenses': {
      const expenses = state.directExpenses || [];
      const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        filename: `Artify_Site_Expenses_${dateStamp}`,
        title: 'Direct Site Expenses & Petty Vouchers Register',
        subtitle: `Operational project expenses, site consumables, and emergency petty cash vouchers`,
        sheetName: 'Site Expenses',
        data: expenses,
        columns: [
          { header: 'Voucher Ref #', key: 'documentRef', width: 18 },
          { header: 'Expense Date', key: 'date', width: 14 },
          { header: 'Expense Head', key: 'expenseHeadName', width: 20 },
          { header: 'Project Name', key: 'projectName', width: 24 },
          { header: 'Paid To', key: 'paidTo', width: 20 },
          { header: 'Account Paid From', key: 'accountName', width: 20 },
          { header: 'Tax / VAT (OMR)', key: 'taxAmount', width: 14, align: 'right', format: (val) => formatOMR(val || 0) },
          { header: 'Total Amount (OMR)', key: 'amount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Status', key: 'status', width: 14, align: 'center' },
        ],
        summaryTotals: {
          documentRef: 'TOTAL SITE EXPENSES',
          amount: formatOMR(totalExpense),
        },
      };
    }

    case 'reports': {
      const journalEntries = accountingService.getJournalEntries();
      const totalDebit = journalEntries.reduce((sum, j) => sum + j.amount, 0);

      return {
        filename: `Artify_General_Journal_Entries_${dateStamp}`,
        title: 'Double-Entry General Journal Audit Register',
        subtitle: `Complete chronological audit of double-entry ledger debit & credit postings`,
        sheetName: 'General Journal',
        data: journalEntries,
        columns: [
          { header: 'Entry #', key: 'entryNumber', width: 16 },
          { header: 'Posting Date', key: 'date', width: 14 },
          { header: 'Source Type', key: 'sourceType', width: 16 },
          { header: 'Description / Narration', key: 'description', width: 32 },
          { header: 'Debit Account', key: 'debitAccount', width: 22 },
          { header: 'Credit Account', key: 'creditAccount', width: 22 },
          { header: 'Amount (OMR)', key: 'amount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Status', key: 'status', width: 14, align: 'center' },
        ],
        summaryTotals: {
          entryNumber: 'TOTAL POSTED',
          amount: formatOMR(totalDebit),
        },
      };
    }

    case 'audit': {
      const auditLogs = state.auditLogs || [];

      return {
        filename: `Artify_Immutable_Audit_Trail_${dateStamp}`,
        title: 'Security & Compliance Immutable Audit Log',
        subtitle: `Cryptographically preserved event log of all administrative, financial, and user actions`,
        sheetName: 'Audit Log',
        data: auditLogs,
        columns: [
          { header: 'Timestamp', key: 'timestamp', width: 20 },
          { header: 'User', key: 'userName', width: 20 },
          { header: 'Role', key: 'userRole', width: 16 },
          { header: 'Module', key: 'module', width: 16 },
          { header: 'Action', key: 'action', width: 18 },
          { header: 'Doc Ref', key: 'documentRef', width: 18, format: (val) => val || '-' },
          { header: 'Audit Details', key: 'details', width: 36 },
        ],
      };
    }

    case 'masters': {
      const masterItems = [
        ...state.projects.map((p) => ({
          type: 'Project',
          code: p.code,
          name: p.name,
          details: `Client: ${p.customerName || 'N/A'} | Value: ${formatOMR(p.contractValue)}`,
          status: p.status,
          date: p.startDate,
        })),
        ...state.customers.map((c) => ({
          type: 'Customer',
          code: c.code,
          name: c.name,
          details: `Contact: ${c.contactPerson || '-'} | Phone: ${c.phone || '-'}`,
          status: c.status,
          date: c.createdAt.split('T')[0],
        })),
        ...state.vendors.map((v) => ({
          type: 'Vendor',
          code: v.code,
          name: v.name,
          details: `Category: ${v.category || '-'} | Phone: ${v.phone || '-'}`,
          status: v.status,
          date: v.createdAt.split('T')[0],
        })),
        ...state.bankAccounts.map((b) => ({
          type: 'Bank Account',
          code: b.accountNumber,
          name: b.accountName,
          details: `Bank: ${b.bankName} | Current Balance: ${formatOMR(b.currentBalance)}`,
          status: b.status,
          date: b.createdAt.split('T')[0],
        })),
      ];

      return {
        filename: `Artify_Master_Records_Directory_${dateStamp}`,
        title: 'Master Records & Relational Entities Directory',
        subtitle: `Consolidated registry of Projects, Customers, Vendors, and Bank Accounts`,
        sheetName: 'Master Directory',
        data: masterItems,
        columns: [
          { header: 'Entity Type', key: 'type', width: 16 },
          { header: 'Unique Code', key: 'code', width: 18 },
          { header: 'Entity Name', key: 'name', width: 28 },
          { header: 'Key Details & Balances', key: 'details', width: 36 },
          { header: 'Status', key: 'status', width: 12, align: 'center' },
          { header: 'Created Date', key: 'date', width: 14 },
        ],
      };
    }

    case 'users':
    case 'roles':
    case 'system_config':
    case 'workflow_settings': {
      const users = authService.getUsers();

      return {
        filename: `Artify_System_Users_${dateStamp}`,
        title: 'System Users & Role-Based Access Control Register',
        subtitle: `Authorized system operators, security roles, and project assignment scopes`,
        sheetName: 'Users & Permissions',
        data: users,
        columns: [
          { header: 'User ID', key: 'id', width: 14 },
          { header: 'Full Name', key: 'fullName', width: 22 },
          { header: 'Email Address', key: 'email', width: 26 },
          { header: 'Assigned Role', key: 'roleName', width: 20 },
          { header: 'Project Scope', key: 'isAllProjects', width: 18, format: (val, row) => row.isAllProjects ? 'All Projects' : `${row.assignedProjectIds?.length || 0} Project(s)` },
          { header: 'Account Status', key: 'status', width: 14, align: 'center' },
        ],
      };
    }

    default: {
      const allTx = accountingService.getAllTransactions();
      return {
        filename: `Artify_Transactions_${dateStamp}`,
        title: `Financial Transactions Register (${activeView})`,
        subtitle: `Exported system transactions for current view: ${activeView}`,
        sheetName: 'Transactions',
        data: allTx,
        columns: [
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Ref #', key: 'documentRef', width: 18 },
          { header: 'Type', key: 'type', width: 16 },
          { header: 'Project', key: 'projectName', width: 24 },
          { header: 'Description', key: 'description', width: 28 },
          { header: 'Amount (OMR)', key: 'amount', width: 16, align: 'right', format: (val) => formatOMR(val) },
          { header: 'Status', key: 'status', width: 14, align: 'center' },
        ],
      };
    }
  }
}

/**
 * Convenience helper to export current active view directly in specified format
 */
export function exportActiveView(
  format: ExportFormat,
  activeView: NavView,
  context?: {
    projectId?: string | null;
    customerId?: string | null;
    vendorId?: string | null;
    accountId?: string | null;
    activeTab?: string | null;
  }
): { filename: string; recordCount: number } {
  const options = getActiveViewExportData(activeView, context);
  exportData(format, options);
  return {
    filename: options.filename,
    recordCount: options.data.length,
  };
}
