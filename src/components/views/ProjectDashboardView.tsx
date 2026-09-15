import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Plus,
  FileSpreadsheet,
  Layers,
  PieChart as PieChartIcon,
  BarChart3,
  ShieldCheck,
  Wallet,
  ExternalLink,
  Users,
  HardHat,
  Receipt,
  Truck,
  Coins,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, formatPercent, addMoney, subtractMoney } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import {
  Project,
  ClientInvoice,
  Purchase,
  DirectExpense,
  MoneyIn,
  MoneyOut,
  ProjectProfitability,
} from '../../types';

interface ProjectDashboardViewProps {
  initialProjectId?: string | null;
  onNavigateToProjectsList: (projectId?: string) => void;
  onOpenClientInvoice: (projectId?: string) => void;
  onOpenPurchase: (projectId?: string) => void;
  onOpenExpense: (projectId?: string) => void;
  onOpenMoneyIn: (projectId?: string) => void;
}

const COST_PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const ProjectDashboardView: React.FC<ProjectDashboardViewProps> = ({
  initialProjectId,
  onNavigateToProjectsList,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenMoneyIn,
}) => {
  const state = accountingService.getState();
  const projects = state.projects;

  // Active project selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId && projects.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : projects[0]?.id || ''
  );

  const [activeChartTab, setActiveChartTab] = useState<'budget' | 'cost_breakdown' | 'billing'>('budget');
  const [pendingFilter, setPendingFilter] = useState<'all' | 'invoices' | 'payables' | 'approvals'>('all');

  const project: Project | undefined = projects.find((p) => p.id === selectedProjectId);

  // Calculate profitability and KPIs for selected project
  const profitability: ProjectProfitability = useMemo(() => {
    if (!selectedProjectId) {
      return {
        projectId: '',
        projectName: 'No Project Selected',
        projectCode: '',
        contractValue: 0,
        totalInvoiced: 0,
        totalReceived: 0,
        receivable: 0,
        outstandingReceivable: 0,
        totalPurchases: 0,
        totalVendorPaid: 0,
        totalVendorPayable: 0,
        totalExpenses: 0,
        totalProjectCost: 0,
        grossProfit: 0,
        profitMarginPercent: 0,
        profitMargin: 0,
      };
    }
    return accountingService.getProjectProfitability(selectedProjectId);
  }, [selectedProjectId, state]);

  // Project Transactions
  const projectInvoices: ClientInvoice[] = useMemo(() => {
    return state.clientInvoices.filter((inv) => inv.projectId === selectedProjectId);
  }, [selectedProjectId, state.clientInvoices]);

  const projectPurchases: Purchase[] = useMemo(() => {
    return state.purchases.filter((p) => p.projectId === selectedProjectId);
  }, [selectedProjectId, state.purchases]);

  const projectExpenses: DirectExpense[] = useMemo(() => {
    return state.directExpenses.filter((e) => e.projectId === selectedProjectId);
  }, [selectedProjectId, state.directExpenses]);

  const projectReceipts: MoneyIn[] = useMemo(() => {
    return state.moneyInList.filter((m) => m.projectId === selectedProjectId);
  }, [selectedProjectId, state.moneyInList]);

  const projectVendorPayments: MoneyOut[] = useMemo(() => {
    return state.moneyOutList.filter((m) => m.projectId === selectedProjectId);
  }, [selectedProjectId, state.moneyOutList]);

  // Budget calculations
  const contractVal = project?.contractValue || 0;
  const budgetCost = project?.budgetCost || Math.round(contractVal * 0.75 * 1000) / 1000;
  const actualCost = profitability.totalProjectCost;
  const costVariance = subtractMoney(budgetCost, actualCost); // positive means under budget, negative means over budget
  const budgetUtilization = budgetCost > 0 ? (actualCost / budgetCost) * 100 : 0;
  const billingProgress = contractVal > 0 ? (profitability.totalInvoiced / contractVal) * 100 : 0;
  const collectionRatio = profitability.totalInvoiced > 0 ? (profitability.totalReceived / profitability.totalInvoiced) * 100 : 0;

  // Net Cash flow on project: Cash Collected - Cash Disbursed (Vendor payments + direct site expenses)
  const cashDisbursed = addMoney(profitability.totalVendorPaid, profitability.totalExpenses);
  const netProjectCashFlow = subtractMoney(profitability.totalReceived, cashDisbursed);

  // Pending Items
  const pendingInvoices = projectInvoices.filter(
    (inv) =>
      inv.status !== 'reversed' &&
      (inv.outstandingAmount ?? Math.max(0, inv.amount - (inv.receivedAmount || 0))) > 0
  );

  const pendingPurchases = projectPurchases.filter(
    (p) =>
      p.status !== 'reversed' &&
      (p.outstandingAmount ?? Math.max(0, p.amount - (p.paidAmount || 0))) > 0
  );

  const pendingApprovals = [
    ...projectInvoices.filter((i) => i.status === 'submitted').map((i) => ({
      id: i.id,
      ref: i.documentRef,
      type: 'Client IPC',
      party: i.customerName || 'Client',
      amount: i.amount,
      date: i.date,
      status: i.status,
    })),
    ...projectPurchases.filter((p) => p.status === 'submitted').map((p) => ({
      id: p.id,
      ref: p.documentRef,
      type: 'Vendor Purchase',
      party: p.vendorName,
      amount: p.amount,
      date: p.date,
      status: p.status,
    })),
    ...projectExpenses.filter((e) => e.status === 'submitted').map((e) => ({
      id: e.id,
      ref: e.documentRef,
      type: 'Site Direct Expense',
      party: e.expenseHeadName,
      amount: e.amount,
      date: e.expenseDate,
      status: e.status,
    })),
  ];

  // Chart Data: Budget vs Actuals
  const budgetVsActualsData = [
    {
      name: 'Budget Plan',
      Revenue: contractVal,
      Cost: budgetCost,
      Profit: Math.max(0, contractVal - budgetCost),
    },
    {
      name: 'Actuals to Date',
      Revenue: profitability.totalInvoiced,
      Cost: actualCost,
      Profit: profitability.grossProfit,
    },
  ];

  // Chart Data: Cost Breakdown
  const costBreakdownData = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    if (profitability.totalPurchases > 0) {
      items.push({ name: 'Vendor Materials & Subs', value: profitability.totalPurchases });
    }
    // Group direct expenses by head
    const expMap = new Map<string, number>();
    projectExpenses.forEach((e) => {
      if (e.status !== 'reversed') {
        const cur = expMap.get(e.expenseHeadName) || 0;
        expMap.set(e.expenseHeadName, addMoney(cur, e.amount));
      }
    });
    expMap.forEach((amt, name) => {
      items.push({ name, value: amt });
    });

    if (items.length === 0) {
      items.push({ name: 'No Cost Recorded', value: 1 });
    }
    return items;
  }, [profitability.totalPurchases, projectExpenses]);

  // Chart Data: Financial Flow
  const financialFlowData = [
    { name: 'Contract Target', amount: contractVal, fill: '#64748b' },
    { name: 'Invoiced (IPC)', amount: profitability.totalInvoiced, fill: '#3b82f6' },
    { name: 'Cash Collected', amount: profitability.totalReceived, fill: '#10b981' },
    { name: 'Actual Cost', amount: actualCost, fill: '#f43f5e' },
    { name: 'Gross Profit', amount: Math.max(0, profitability.grossProfit), fill: '#8b5cf6' },
  ];

  // Export Financial Brief to Excel
  const handleExportFinancialBrief = () => {
    if (!project) return;
    const summaryData = [
      { Metric: 'Project Code', Value: project.code },
      { Metric: 'Project Name', Value: project.name },
      { Metric: 'Client / Employer', Value: project.customerName || 'N/A' },
      { Metric: 'Contract Value (OMR)', Value: contractVal },
      { Metric: 'Approved Budget Cost (OMR)', Value: budgetCost },
      { Metric: 'Invoiced Revenue to Date (OMR)', Value: profitability.totalInvoiced },
      { Metric: 'Actual Cost Incurred (OMR)', Value: actualCost },
      { Metric: 'Gross Profit (OMR)', Value: profitability.grossProfit },
      { Metric: 'Profit Margin (%)', Value: `${profitability.profitMarginPercent.toFixed(2)}%` },
      { Metric: 'Budget Utilization (%)', Value: `${budgetUtilization.toFixed(2)}%` },
      { Metric: 'Cost Variance (OMR)', Value: costVariance },
      { Metric: 'Cash Collected from Client (OMR)', Value: profitability.totalReceived },
      { Metric: 'Outstanding Client Receivable (OMR)', Value: profitability.outstandingReceivable },
      { Metric: 'Vendor Purchases (OMR)', Value: profitability.totalPurchases },
      { Metric: 'Vendor Payments Made (OMR)', Value: profitability.totalVendorPaid },
      { Metric: 'Outstanding Vendor Payables (OMR)', Value: profitability.totalVendorPayable },
      { Metric: 'Direct Site Expenses (OMR)', Value: profitability.totalExpenses },
      { Metric: 'Net Project Cash Position (OMR)', Value: netProjectCashFlow },
    ];

    exportToExcel({
      filename: `Project_KPI_Brief_${project.code}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Project Financial KPIs',
      title: `PROJECT FINANCIAL KPI BRIEF — ${project.name.toUpperCase()}`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data: summaryData,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Project Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                <Building2 className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Project Financial Dashboard
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time project-wise KPIs, budget vs. actual variance, billing progress, and pending items.
                </p>
              </div>
            </div>
          </div>

          {/* Project Switcher Selector & Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[260px] sm:min-w-[320px]">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Select Project"
                className="w-full pl-3 pr-10 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer appearance-none shadow-xs"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({p.customerName || 'Client'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={handleExportFinancialBrief}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export KPI Brief</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToProjectsList(selectedProjectId)}
              className="px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Project Ledger</span>
            </button>
          </div>
        </div>

        {/* Selected Project Quick Metadata Bar */}
        {project && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Client / Employer</span>
              <p className="font-bold text-slate-900 dark:text-white truncate">{project.customerName || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Contract Value</span>
              <p className="font-mono font-bold text-slate-900 dark:text-white">{formatOMR(contractVal)}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Budgeted Target Cost</span>
              <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatOMR(budgetCost)}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Commencement Date</span>
              <p className="font-medium text-slate-700 dark:text-slate-300">{project.startDate || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Target Completion</span>
              <p className="font-medium text-slate-700 dark:text-slate-300">{project.endDate || 'Ongoing'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Status</span>
              <div className="mt-0.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {project.status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4 Main KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue & Billing Progress */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Revenue &amp; Billing</span>
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {formatOMR(profitability.totalInvoiced)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex justify-between">
              <span>Contract: {formatOMR(contractVal)}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{billingProgress.toFixed(1)}%</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, billingProgress))}%` }}
            />
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px]">
            <span className="text-slate-500">Unbilled Value:</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {formatOMR(Math.max(0, contractVal - profitability.totalInvoiced))}
            </span>
          </div>
        </div>

        {/* Card 2: Budget vs Actual Cost */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Cost Budget vs. Actual</span>
            <HardHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {formatOMR(actualCost)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex justify-between">
              <span>Budget: {formatOMR(budgetCost)}</span>
              <span
                className={`font-bold ${
                  budgetUtilization > 100
                    ? 'text-rose-600 dark:text-rose-400'
                    : budgetUtilization > 85
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {budgetUtilization.toFixed(1)}%
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                budgetUtilization > 100 ? 'bg-rose-600' : budgetUtilization > 85 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, budgetUtilization))}%` }}
            />
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px]">
            <span className="text-slate-500">{costVariance >= 0 ? 'Cost Savings Buffer:' : 'Budget Overrun:'}</span>
            <span
              className={`font-mono font-medium ${
                costVariance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400 font-bold'
              }`}
            >
              {costVariance >= 0 ? '+' : ''}{formatOMR(costVariance)}
            </span>
          </div>
        </div>

        {/* Card 3: Gross Profit & Margin */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Profitability &amp; Margin</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <div
              className={`text-xl font-bold font-mono ${
                profitability.grossProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {profitability.grossProfit >= 0 ? '+' : ''}
              {formatOMR(profitability.grossProfit)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex justify-between">
              <span>Gross Margin:</span>
              <span
                className={`font-bold ${
                  profitability.profitMarginPercent >= 15
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : profitability.profitMarginPercent >= 5
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {profitability.profitMarginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px]">
            <span
              className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                profitability.profitMarginPercent >= 15
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : profitability.profitMarginPercent >= 5
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              {profitability.profitMarginPercent >= 15
                ? 'Strong Profitability'
                : profitability.profitMarginPercent >= 5
                ? 'Moderate Margin'
                : 'Margin Compression'}
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px]">
            <span className="text-slate-500">Project Net Cash Flow:</span>
            <span
              className={`font-mono font-medium ${
                netProjectCashFlow >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {netProjectCashFlow >= 0 ? '+' : ''}{formatOMR(netProjectCashFlow)}
            </span>
          </div>
        </div>

        {/* Card 4: Cash Collections & Receivables */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Cash Inflow &amp; Receivables</span>
            <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatOMR(profitability.totalReceived)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex justify-between">
              <span>Collection Ratio:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{collectionRatio.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, collectionRatio))}%` }}
            />
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px]">
            <span className="text-slate-500">Due from Client:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {formatOMR(profitability.outstandingReceivable)}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Charts & Financial Deep-Dive Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Main Visual Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Project Financial Visualization
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparative analysis of project budget benchmarks, incurred costs, and billing cycles.
              </p>
            </div>

            {/* Chart Switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveChartTab('budget')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeChartTab === 'budget'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Budget vs. Actuals
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('cost_breakdown')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeChartTab === 'cost_breakdown'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Cost Breakdown
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('billing')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeChartTab === 'billing'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Financial Funnel
              </button>
            </div>
          </div>

          {/* Chart Canvas */}
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              {activeChartTab === 'budget' ? (
                <BarChart data={budgetVsActualsData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatOMR(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Cost" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              ) : activeChartTab === 'cost_breakdown' ? (
                <div className="h-full flex flex-col sm:flex-row items-center justify-around">
                  <div className="h-56 w-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costBreakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {costBreakdownData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COST_PIE_COLORS[index % COST_PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [formatOMR(Number(val)), '']}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '8px',
                            border: 'none',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Custom Legend */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-2 text-xs">
                    {costBreakdownData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: COST_PIE_COLORS[idx % COST_PIE_COLORS.length] }}
                        />
                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                          {entry.name}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white ml-auto">
                          {formatOMR(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <BarChart data={financialFlowData} layout="vertical" margin={{ top: 10, right: 20, left: 70, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [formatOMR(Number(val)), 'Amount']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {financialFlowData.map((entry, index) => (
                      <Cell key={`cell-flow-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Column: Quick Action Center & Cost Structure Brief */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              Project Action Center
            </h3>

            {/* Direct Transaction Initiation */}
            <div className="mt-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Post Project Entry
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenClientInvoice(selectedProjectId)}
                  className="p-2.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Client IPC</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPurchase(selectedProjectId)}
                  className="p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Vendor Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenExpense(selectedProjectId)}
                  className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Site Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMoneyIn(selectedProjectId)}
                  className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Receipt (In)</span>
                </button>
              </div>
            </div>

            {/* Cost Breakdown Quick Summary */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Cost &amp; Liability Structure
              </span>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Vendor Material Purchases:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatOMR(profitability.totalPurchases)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Vendor Bills Settled:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatOMR(profitability.totalVendorPaid)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Vendor Payables Due:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {formatOMR(profitability.totalVendorPayable)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <span>Direct Site Expenses &amp; Labor:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatOMR(profitability.totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-medium">Strict Anti-Double-Counting Enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Items Tabular Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Action Items &amp; Outstanding Balances ({project?.name})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transactions requiring collection, vendor payment, or managerial workflow approval.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setPendingFilter('all')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                pendingFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Items ({pendingInvoices.length + pendingPurchases.length + pendingApprovals.length})
            </button>
            <button
              type="button"
              onClick={() => setPendingFilter('invoices')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                pendingFilter === 'invoices'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Unpaid IPCs ({pendingInvoices.length})
            </button>
            <button
              type="button"
              onClick={() => setPendingFilter('payables')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                pendingFilter === 'payables'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Vendor Payables ({pendingPurchases.length})
            </button>
            <button
              type="button"
              onClick={() => setPendingFilter('approvals')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                pendingFilter === 'approvals'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Pending Approval ({pendingApprovals.length})
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4">Party</th>
                <th className="py-2.5 px-4 text-right">Total (OMR)</th>
                <th className="py-2.5 px-4 text-right">Outstanding (OMR)</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Combine items according to active filter */}
              {pendingFilter === 'all' || pendingFilter === 'invoices'
                ? pendingInvoices.map((inv) => {
                    const outstanding =
                      inv.outstandingAmount ?? Math.max(0, inv.amount - (inv.receivedAmount || 0));
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{inv.date}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            Client IPC
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                          #{inv.invoiceNumber} <span className="text-slate-400 font-normal font-mono">({inv.documentRef})</span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{inv.customerName || 'Client'}</td>
                        <td className="py-2.5 px-4 font-mono text-right text-slate-900 dark:text-white">
                          {formatOMR(inv.amount)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right font-bold text-amber-600 dark:text-amber-400">
                          {formatOMR(outstanding)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onOpenMoneyIn(selectedProjectId)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                          >
                            Receive Cash
                          </button>
                        </td>
                      </tr>
                    );
                  })
                : null}

              {pendingFilter === 'all' || pendingFilter === 'payables'
                ? pendingPurchases.map((p) => {
                    const outstanding =
                      p.outstandingAmount ?? Math.max(0, p.amount - (p.paidAmount || 0));
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{p.date}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            Vendor Bill
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                          #{p.purchaseInvoiceNumber} <span className="text-slate-400 font-normal font-mono">({p.documentRef})</span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{p.vendorName}</td>
                        <td className="py-2.5 px-4 font-mono text-right text-slate-900 dark:text-white">
                          {formatOMR(p.amount)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right font-bold text-rose-600 dark:text-rose-400">
                          {formatOMR(outstanding)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="text-xs text-slate-400">Via Banking</span>
                        </td>
                      </tr>
                    );
                  })
                : null}

              {pendingFilter === 'all' || pendingFilter === 'approvals'
                ? pendingApprovals.map((appr) => (
                    <tr
                      key={appr.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors bg-amber-50/20 dark:bg-amber-950/10"
                    >
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{appr.date}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                          {appr.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                        {appr.ref}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{appr.party}</td>
                      <td className="py-2.5 px-4 font-mono text-right text-slate-900 dark:text-white">
                        {formatOMR(appr.amount)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-right text-slate-500">—</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" /> Submitted
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Awaiting Sign-off
                        </span>
                      </td>
                    </tr>
                  ))
                : null}

              {pendingInvoices.length === 0 &&
                pendingPurchases.length === 0 &&
                pendingApprovals.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      No pending items or outstanding balances for this project!
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
