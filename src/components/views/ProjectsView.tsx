import React, { useState, useMemo } from 'react';
import {
  Plus,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  Filter,
  Search,
  X,
  ArrowUpDown,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, formatPercent, addMoney } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import {
  DatePreset,
  getDateRangeFromPreset,
  isDateInRange,
} from '../../utils/reportFilters';

interface ProjectsViewProps {
  selectedProjectId?: string | null;
  onClearSelectedProject: () => void;
  onSelectProject: (id: string) => void;
  onOpenNewProject: () => void;
  onOpenClientInvoice: (projectId?: string) => void;
  onOpenPurchase: (projectId?: string) => void;
  onOpenExpense: (projectId?: string) => void;
  onOpenMoneyIn: (projectId?: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  selectedProjectId,
  onClearSelectedProject,
  onSelectProject,
  onOpenNewProject,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenMoneyIn,
}) => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'invoices' | 'purchases' | 'expenses'>('ledger');
  const state = accountingService.getState();

  // Master view quick filters
  const [masterMarginFilter, setMasterMarginFilter] = useState<'all' | 'high' | 'mid' | 'low' | 'loss'>('all');
  const [masterSearch, setMasterSearch] = useState<string>('');
  const [masterSort, setMasterSort] = useState<'margin_desc' | 'profit_desc' | 'contract_desc' | 'cost_desc' | 'code_asc'>('margin_desc');

  // Project Detail view quick filters
  const [detailDatePreset, setDetailDatePreset] = useState<DatePreset>('all');
  const [detailCustomStart, setDetailCustomStart] = useState<string>('');
  const [detailCustomEnd, setDetailCustomEnd] = useState<string>('');
  const [detailSearch, setDetailSearch] = useState<string>('');

  const detailDateRange = useMemo(() => {
    return getDateRangeFromPreset(detailDatePreset, detailCustomStart, detailCustomEnd);
  }, [detailDatePreset, detailCustomStart, detailCustomEnd]);

  const selectedProject = selectedProjectId
    ? state.projects.find((p) => p.id === selectedProjectId)
    : null;

  const profitability = selectedProject
    ? accountingService.getProjectProfitability(selectedProject.id)
    : null;

  const rawProjectLedger = selectedProject
    ? accountingService.getProjectLedger(selectedProject.id)
    : [];

  const rawProjectInvoices = selectedProject
    ? state.clientInvoices.filter((inv) => inv.projectId === selectedProject.id)
    : [];

  const rawProjectPurchases = selectedProject
    ? state.purchases.filter((pur) => pur.projectId === selectedProject.id)
    : [];

  const rawProjectExpenses = selectedProject
    ? state.directExpenses.filter((exp) => exp.projectId === selectedProject.id)
    : [];

  // Filtered detail datasets
  const projectLedger = useMemo(() => {
    return rawProjectLedger.filter((row) => {
      if (!isDateInRange(row.date, detailDateRange.startDate, detailDateRange.endDate)) return false;
      if (detailSearch.trim()) {
        const q = detailSearch.toLowerCase();
        const matchRef = row.documentRef.toLowerCase().includes(q);
        const matchDesc = row.description.toLowerCase().includes(q);
        const matchParty = (row.party || '').toLowerCase().includes(q);
        if (!matchRef && !matchDesc && !matchParty) return false;
      }
      return true;
    });
  }, [rawProjectLedger, detailDateRange, detailSearch]);

  const projectInvoices = useMemo(() => {
    return rawProjectInvoices.filter((inv) => {
      if (!isDateInRange(inv.date, detailDateRange.startDate, detailDateRange.endDate)) return false;
      if (detailSearch.trim()) {
        const q = detailSearch.toLowerCase();
        const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
        const matchDesc = (inv.description || '').toLowerCase().includes(q);
        if (!matchNum && !matchDesc) return false;
      }
      return true;
    });
  }, [rawProjectInvoices, detailDateRange, detailSearch]);

  const projectPurchases = useMemo(() => {
    return rawProjectPurchases.filter((pur) => {
      if (!isDateInRange(pur.date, detailDateRange.startDate, detailDateRange.endDate)) return false;
      if (detailSearch.trim()) {
        const q = detailSearch.toLowerCase();
        const matchNum = pur.purchaseInvoiceNumber.toLowerCase().includes(q);
        const matchVend = pur.vendorName.toLowerCase().includes(q);
        const matchDesc = (pur.description || '').toLowerCase().includes(q);
        if (!matchNum && !matchVend && !matchDesc) return false;
      }
      return true;
    });
  }, [rawProjectPurchases, detailDateRange, detailSearch]);

  const projectExpenses = useMemo(() => {
    return rawProjectExpenses.filter((exp) => {
      if (!isDateInRange(exp.expenseDate, detailDateRange.startDate, detailDateRange.endDate)) return false;
      if (detailSearch.trim()) {
        const q = detailSearch.toLowerCase();
        const matchHead = exp.expenseHeadName.toLowerCase().includes(q);
        const matchDesc = exp.description.toLowerCase().includes(q);
        const matchRef = exp.documentRef.toLowerCase().includes(q);
        if (!matchHead && !matchDesc && !matchRef) return false;
      }
      return true;
    });
  }, [rawProjectExpenses, detailDateRange, detailSearch]);

  const rawProfitabilities = accountingService.getAllProjectProfitabilities();

  // Filtered Master Projects
  const filteredProfitabilities = useMemo(() => {
    let list = [...rawProfitabilities];

    if (masterMarginFilter === 'high') {
      list = list.filter((p) => p.profitMargin >= 15);
    } else if (masterMarginFilter === 'mid') {
      list = list.filter((p) => p.profitMargin >= 5 && p.profitMargin < 15);
    } else if (masterMarginFilter === 'low') {
      list = list.filter((p) => p.profitMargin >= 0 && p.profitMargin < 5);
    } else if (masterMarginFilter === 'loss') {
      list = list.filter((p) => p.profitMargin < 0);
    }

    if (masterSearch.trim()) {
      const q = masterSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.projectCode.toLowerCase().includes(q) ||
          p.projectName.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (masterSort === 'margin_desc') return b.profitMargin - a.profitMargin;
      if (masterSort === 'profit_desc') return b.grossProfit - a.grossProfit;
      if (masterSort === 'contract_desc') return b.contractValue - a.contractValue;
      if (masterSort === 'cost_desc') return b.totalProjectCost - a.totalProjectCost;
      if (masterSort === 'code_asc') return a.projectCode.localeCompare(b.projectCode);
      return 0;
    });

    return list;
  }, [rawProfitabilities, masterMarginFilter, masterSearch, masterSort]);

  const masterTotals = useMemo(() => {
    const totalContract = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.contractValue), 0);
    const totalInvoiced = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.totalInvoiced), 0);
    const totalCost = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.totalProjectCost), 0);
    const totalProfit = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.grossProfit), 0);
    return { totalContract, totalInvoiced, totalCost, totalProfit, count: filteredProfitabilities.length };
  }, [filteredProfitabilities]);

  const handleExportProjectLedger = () => {
    if (!selectedProject) return;

    const data = projectLedger.map((row) => ({
      'Date': row.date,
      'Doc Ref': row.documentRef,
      'Type': row.type.replace('_', ' '),
      'Party / Account': row.party || '—',
      'Description': row.description,
      'Revenue Credit (OMR)': row.revenue > 0 ? row.revenue : '',
      'Cost Debit (OMR)': row.cost > 0 ? row.cost : '',
      'Cash Receipt (OMR)': row.cashReceived > 0 ? row.cashReceived : '',
      'Cash Payment (OMR)': row.cashPaid > 0 ? row.cashPaid : '',
      'Cumulative Net Profit (OMR)': row.cumulativeProfit,
    }));

    exportToExcel({
      filename: `Project_Ledger_${selectedProject.code}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Project Ledger',
      title: `PROJECT STATEMENT OF ACCOUNT & COST LEDGER — ${selectedProject.name.toUpperCase()}`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  const handleExportAllProjects = () => {
    const data = filteredProfitabilities.map((p) => ({
      'Project Code': p.projectCode,
      'Project Name': p.projectName,
      'Client': p.customerName,
      'Contract Value (OMR)': p.contractValue,
      'Invoiced Revenue (OMR)': p.totalInvoiced,
      'Cash Received (OMR)': p.totalReceived,
      'Receivable Due (OMR)': p.outstandingReceivable,
      'Materials & Purchases (OMR)': p.totalPurchases,
      'Direct Expenses (OMR)': p.totalExpenses,
      'Total Project Cost (OMR)': p.totalProjectCost,
      'Gross Profit (OMR)': p.grossProfit,
      'Margin %': `${p.profitMargin.toFixed(2)}%`,
    }));

    exportToExcel({
      filename: `All_Projects_Report_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Projects',
      title: 'MASTER CONSTRUCTION PROJECTS SUMMARY REPORT (FILTERED)',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  // If a project is selected, show Deep Project Detail View
  if (selectedProject && profitability) {
    return (
      <div className="space-y-6">
        {/* Back and Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onClearSelectedProject}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Construction Projects
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenClientInvoice(selectedProject.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-700 hover:bg-blue-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Client Invoice / IPC
            </button>
            <button
              onClick={() => onOpenPurchase(selectedProject.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-amber-700 hover:bg-amber-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Purchase
            </button>
            <button
              onClick={() => onOpenExpense(selectedProject.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-rose-700 hover:bg-rose-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Direct Expense
            </button>
            <button
              onClick={() => onOpenMoneyIn(selectedProject.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-700 hover:bg-emerald-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Record Receipt
            </button>
            <button
              onClick={handleExportProjectLedger}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Project Statement
            </button>
          </div>
        </div>

        {/* Project Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedProject.code}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    selectedProject.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {selectedProject.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1.5">{selectedProject.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Client: <span className="font-medium text-slate-800">{profitability.customerName}</span> | Start Date: {selectedProject.startDate}
              </p>
            </div>

            {/* Anti-Double-Counting Architecture Notice */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 max-w-md">
              <div className="font-semibold text-slate-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Anti-Double-Counting Verified:
              </div>
              <div className="mt-1 text-[11px] leading-relaxed">
                Project Cost = Purchases ({formatOMR(profitability.totalPurchases)}) + Direct Expenses ({formatOMR(profitability.totalExpenses)}) = <strong>{formatOMR(profitability.totalProjectCost)}</strong>. Vendor payments are treasury settlements, NOT cost additions.
              </div>
            </div>
          </div>

          {/* Project Metrics Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">Contract Value</span>
              <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                {formatOMR(selectedProject.contractValue)}
              </div>
            </div>

            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              <span className="text-[11px] text-blue-700 font-medium">Invoiced (Revenue)</span>
              <div className="text-sm font-bold text-blue-900 font-mono mt-0.5">
                {formatOMR(profitability.totalInvoiced)}
              </div>
            </div>

            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
              <span className="text-[11px] text-emerald-700 font-medium">Cash Collected</span>
              <div className="text-sm font-bold text-emerald-900 font-mono mt-0.5">
                {formatOMR(profitability.totalReceived)}
              </div>
            </div>

            <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
              <span className="text-[11px] text-amber-700 font-medium">Client Due (AR)</span>
              <div className="text-sm font-bold text-amber-900 font-mono mt-0.5">
                {formatOMR(profitability.outstandingReceivable)}
              </div>
            </div>

            <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
              <span className="text-[11px] text-rose-700 font-medium">Total Project Cost</span>
              <div className="text-sm font-bold text-rose-900 font-mono mt-0.5">
                {formatOMR(profitability.totalProjectCost)}
              </div>
            </div>

            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-emerald-800 font-medium">Project Profit</span>
              <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                {formatOMR(profitability.grossProfit)}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                Margin: {formatPercent(profitability.profitMargin)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for Project Views */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 px-6 flex items-center gap-6">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`py-3.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'ledger'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Project Cost &amp; Profit Ledger ({projectLedger.length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-3.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Client Invoices / IPC ({projectInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`py-3.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'purchases'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Vendor Purchases ({projectPurchases.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-3.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'expenses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Direct Site Expenses ({projectExpenses.length})
            </button>
          </div>

          {/* Quick Filters for Project Tab */}
          <div className="bg-slate-50/80 px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-600" /> Period:
              </span>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'this_month', label: 'This Month' },
                { id: 'this_quarter', label: 'This Quarter' },
                { id: 'this_year', label: 'This Year' },
                { id: 'custom', label: 'Custom Range' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setDetailDatePreset(btn.id as DatePreset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                    detailDatePreset === btn.id
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {detailDatePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-200 pl-3">
                <span className="text-slate-600 font-medium">From:</span>
                <input
                  type="date"
                  value={detailCustomStart}
                  onChange={(e) => setDetailCustomStart(e.target.value)}
                  className="px-2 py-0.5 text-[11px] border border-slate-200 rounded bg-white text-slate-800 focus:outline-none"
                />
                <span className="text-slate-600 font-medium">To:</span>
                <input
                  type="date"
                  value={detailCustomEnd}
                  onChange={(e) => setDetailCustomEnd(e.target.value)}
                  className="px-2 py-0.5 text-[11px] border border-slate-200 rounded bg-white text-slate-800 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search in tab..."
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-44"
                />
                {detailSearch && (
                  <button
                    onClick={() => setDetailSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {(detailDatePreset !== 'all' || detailSearch) && (
                <button
                  onClick={() => {
                    setDetailDatePreset('all');
                    setDetailCustomStart('');
                    setDetailCustomEnd('');
                    setDetailSearch('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                  title="Reset tab filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="p-0">
            {activeTab === 'ledger' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Doc Ref</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Party / Account</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Revenue (Cr)</th>
                      <th className="py-3 px-4 text-right">Cost (Dr)</th>
                      <th className="py-3 px-4 text-right">Cash In</th>
                      <th className="py-3 px-4 text-right">Cash Out</th>
                      <th className="py-3 px-4 text-right">Cumul. Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectLedger.map((row, idx) => (
                      <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {row.documentRef}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {row.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                          {row.party || '—'}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={row.description}>
                          {row.description}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700 whitespace-nowrap">
                          {row.revenue > 0 ? formatOMR(row.revenue) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-rose-700 whitespace-nowrap">
                          {row.cost > 0 ? formatOMR(row.cost) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                          {row.cashReceived > 0 ? formatOMR(row.cashReceived) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                          {row.cashPaid > 0 ? formatOMR(row.cashPaid) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatOMR(row.cumulativeProfit)}
                        </td>
                      </tr>
                    ))}
                    {projectLedger.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-slate-400">
                          No accounting entries posted for this project yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Invoiced Amount</th>
                      <th className="py-3 px-4 text-right">Received</th>
                      <th className="py-3 px-4 text-right">Outstanding</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectInvoices.map((inv, idx) => (
                      <tr key={`${inv.id}-${idx}`} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-slate-600">{inv.date}</td>
                        <td className="py-3 px-4 font-semibold text-blue-700">{inv.invoiceType}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-slate-600">{inv.description || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {formatOMR(inv.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-700">
                          {formatOMR(inv.receivedAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          {formatOMR(inv.outstandingAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              inv.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : inv.status === 'partially_paid'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {inv.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {projectInvoices.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          No client invoices recorded. Click &quot;+ Client Invoice / IPC&quot; above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'purchases' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Purchase Bill #</th>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Bill Amount</th>
                      <th className="py-3 px-4 text-right">Paid</th>
                      <th className="py-3 px-4 text-right">Outstanding</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectPurchases.map((p, idx) => (
                      <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-slate-600">{p.date}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{p.purchaseInvoiceNumber}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.vendorName}</td>
                        <td className="py-3 px-4 text-slate-600">{p.purchaseCategory}</td>
                        <td className="py-3 px-4 text-slate-600">{p.description}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {formatOMR(p.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-700">
                          {formatOMR(p.paidAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          {formatOMR(p.outstandingAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              p.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : p.status === 'partially_paid'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {projectPurchases.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-slate-400">
                          No vendor purchases recorded for this project yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Doc Ref</th>
                      <th className="py-3 px-4">Expense Head</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Paid From</th>
                      <th className="py-3 px-4 text-right">Amount (OMR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectExpenses.map((exp, idx) => (
                      <tr key={`${exp.id}-${idx}`} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-slate-600">{exp.expenseDate}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{exp.documentRef}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{exp.expenseHeadName}</td>
                        <td className="py-3 px-4 text-slate-600">{exp.description}</td>
                        <td className="py-3 px-4 capitalize text-slate-700">{exp.paidFrom.replace('_', ' ')}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-rose-700">
                          {formatOMR(exp.amount)}
                        </td>
                      </tr>
                    ))}
                    {projectExpenses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No direct site expenses recorded for this project yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Master Projects List View
  return (
    <div className="space-y-5">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Construction Projects Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time project-wise accounting, cost centers, profitability tracking, and margin analysis
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportAllProjects}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export Master Summary
          </button>
          <button
            onClick={onOpenNewProject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            New Construction Project
          </button>
        </div>
      </div>

      {/* Master Quick Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Margin quick filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" /> Margin:
          </span>
          {[
            { id: 'all', label: 'All Margins' },
            { id: 'high', label: 'High (≥15%)' },
            { id: 'mid', label: 'Healthy (5-15%)' },
            { id: 'low', label: 'Low (0-5%)' },
            { id: 'loss', label: 'Loss (<0%)' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMasterMarginFilter(item.id as any)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                masterMarginFilter === item.id
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, name, client..."
              value={masterSearch}
              onChange={(e) => setMasterSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-52"
            />
            {masterSearch && (
              <button
                onClick={() => setMasterSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={masterSort}
              onChange={(e) => setMasterSort(e.target.value as any)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="margin_desc">Sort: Margin %</option>
              <option value="profit_desc">Sort: Gross Profit</option>
              <option value="contract_desc">Sort: Contract Value</option>
              <option value="cost_desc">Sort: Total Cost</option>
              <option value="code_asc">Sort: Project Code</option>
            </select>
          </div>

          {(masterMarginFilter !== 'all' || masterSearch) && (
            <button
              onClick={() => {
                setMasterMarginFilter('all');
                setMasterSearch('');
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
              title="Reset filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Portfolio Totals for the currently filtered project set */}
      {masterTotals.count > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white rounded-xl border border-slate-200 p-4 text-xs">
          <div>
            <span className="text-[10px] text-slate-400">Portfolio Contract Value ({masterTotals.count})</span>
            <div className="font-mono font-semibold text-slate-800">{formatOMR(masterTotals.totalContract)}</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400">Portfolio Revenue Invoiced</span>
            <div className="font-mono font-semibold text-blue-700">{formatOMR(masterTotals.totalInvoiced)}</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400">Portfolio Total Cost</span>
            <div className="font-mono font-semibold text-rose-700">{formatOMR(masterTotals.totalCost)}</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400">Portfolio Gross Profit</span>
            <div className="font-mono font-bold text-emerald-600">{formatOMR(masterTotals.totalProfit)}</div>
          </div>
        </div>
      )}

      {/* Projects Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProfitabilities.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
            No construction projects match the active quick filters.
          </div>
        ) : (
          filteredProfitabilities.map((p) => (
            <div
              key={p.projectId}
              onClick={() => onSelectProject(p.projectId)}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {p.projectCode}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Margin: {formatPercent(p.profitMargin)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5 hover:text-blue-600 transition-colors">
                  {p.projectName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Client: {p.customerName}</p>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400">Contract Value</span>
                    <div className="font-mono font-medium text-slate-800">{formatOMR(p.contractValue)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Revenue Invoiced</span>
                    <div className="font-mono font-semibold text-blue-700">{formatOMR(p.totalInvoiced)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Total Project Cost</span>
                    <div className="font-mono font-medium text-rose-700">{formatOMR(p.totalProjectCost)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Net Gross Profit</span>
                    <div className="font-mono font-bold text-emerald-600">{formatOMR(p.grossProfit)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Recvd: {formatOMR(p.totalReceived)}</span>
                <span className="text-blue-600 font-medium flex items-center gap-0.5 hover:underline">
                  View Full Ledger &rarr;
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectsView;
