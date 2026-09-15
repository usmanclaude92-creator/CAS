import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Landmark,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  FileText,
  RotateCcw,
  ExternalLink,
  Plus,
  HardHat,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Users,
  Truck,
  Coins,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, formatPercent, addMoney, subtractMoney } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import { Transaction, Project, ClientInvoice, Purchase, DirectExpense } from '../../types';
import { CashFlowProjectionCard } from '../dashboard/CashFlowProjectionCard';
import { DashboardFilterBar } from '../dashboard/DashboardFilterBar';
import {
  DashboardAnalyticsCharts,
  MonthlyTrendPoint,
  CostCategoryPoint,
  ProjectMarginPoint,
  BudgetVariancePoint,
} from '../dashboard/DashboardAnalyticsCharts';
import { DatePreset, getDateRangeFromPreset, isDateInRange } from '../../utils/reportFilters';

export interface DashboardViewProps {
  initialScope?: 'overall' | 'project';
  initialProjectId?: string | null;
  onOpenMoneyIn: (projectId?: string) => void;
  onOpenMoneyOut: () => void;
  onOpenClientInvoice: (projectId?: string) => void;
  onOpenPurchase: (projectId?: string) => void;
  onOpenExpense: (projectId?: string) => void;
  onOpenTransfer?: () => void;
  onSelectProject?: (projectId: string) => void;
  onSelectCustomer?: (customerId: string) => void;
  onSelectVendor?: (vendorId: string) => void;
  onReverseTransaction?: (txn: Transaction) => void;
  onNavigateToProjectsList?: (projectId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  initialScope = 'overall',
  initialProjectId,
  onOpenMoneyIn,
  onOpenMoneyOut,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenTransfer,
  onSelectProject,
  onSelectCustomer,
  onSelectVendor,
  onReverseTransaction,
  onNavigateToProjectsList,
}) => {
  const state = accountingService.getState();
  const projects = state.projects || [];

  // Scope: 'overall' (consolidated company-wide) vs 'project' (single project drilldown)
  const [scope, setScope] = useState<'overall' | 'project'>(initialScope);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjectId && projects.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : projects[0]?.id || null
  );

  // Period Filtering
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Transactions Search & Filtering
  const [txnSearchTerm, setTxnSearchTerm] = useState('');
  const [txnFilterType, setTxnFilterType] = useState<string>('all');

  // Compute active date range
  const dateRange = useMemo(() => {
    return getDateRangeFromPreset(datePreset, customStartDate, customEndDate);
  }, [datePreset, customStartDate, customEndDate]);

  const isFilterActive = datePreset !== 'all' || (scope === 'project' && initialScope !== 'project');

  const handleResetFilters = () => {
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setScope('overall');
    setSelectedProjectId(null);
  };

  // Selected Project Object
  const currentProject = useMemo(() => {
    if (scope !== 'project' || !selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [scope, selectedProjectId, projects]);

  // All Project Profitabilities (Cumulative)
  const allProfitabilities = useMemo(() => {
    return accountingService.getAllProjectProfitabilities();
  }, [state]);

  // Filtered dataset based on Scope & Period
  const analyticsData = useMemo(() => {
    const { startDate, endDate } = dateRange;

    // Filter by project if in project mode
    const projFilter = (itemProjectId?: string | null) => {
      if (scope === 'overall' || !selectedProjectId) return true;
      return itemProjectId === selectedProjectId;
    };

    // Filter by date
    const dateFilter = (dateStr?: string | null) => {
      if (!startDate && !endDate) return true;
      return isDateInRange(dateStr, startDate, endDate);
    };

    // Client Invoices
    const relevantInvoices = state.clientInvoices.filter(
      (inv) => inv.status !== 'reversed' && projFilter(inv.projectId)
    );
    const periodInvoices = relevantInvoices.filter((inv) => dateFilter(inv.date));

    // Purchases
    const relevantPurchases = state.purchases.filter(
      (p) => p.status !== 'reversed' && projFilter(p.projectId)
    );
    const periodPurchases = relevantPurchases.filter((p) => dateFilter(p.date));

    // Direct Expenses
    const relevantExpenses = state.directExpenses.filter(
      (e) => e.status !== 'reversed' && projFilter(e.projectId)
    );
    const periodExpenses = relevantExpenses.filter((e) => dateFilter(e.expenseDate));

    // Money In (Receipts)
    const relevantReceipts = state.moneyInList.filter(
      (m) => m.status !== 'reversed' && projFilter(m.projectId)
    );
    const periodReceipts = relevantReceipts.filter((m) => dateFilter(m.transactionDate));

    // Money Out (Vendor Payments & Expenses)
    const relevantPayments = state.moneyOutList.filter(
      (m) => m.status !== 'reversed' && projFilter(m.projectId)
    );
    const periodPayments = relevantPayments.filter((m) => dateFilter(m.transactionDate));

    // Cumulative sums (lifetime to date)
    const cumRevenue = relevantInvoices.reduce((sum, i) => addMoney(sum, i.amount), 0);
    const cumReceived = relevantReceipts.reduce((sum, r) => addMoney(sum, r.amount), 0);
    const cumPurchases = relevantPurchases.reduce((sum, p) => addMoney(sum, p.amount), 0);
    const cumDirectExpenses = relevantExpenses.reduce((sum, e) => addMoney(sum, e.amount), 0);
    const cumVendorPaid = relevantPayments
      .filter((p) => p.paymentFor === 'purchase')
      .reduce((sum, p) => addMoney(sum, p.amount), 0);
    const cumTotalCost = addMoney(cumPurchases, cumDirectExpenses);
    const cumGrossProfit = subtractMoney(cumRevenue, cumTotalCost);
    const cumMargin = cumRevenue > 0 ? (cumGrossProfit / cumRevenue) * 100 : 0;
    const cumReceivable = Math.max(0, subtractMoney(cumRevenue, cumReceived));
    const cumPayable = Math.max(0, subtractMoney(cumPurchases, cumVendorPaid));

    // Period-specific sums
    const periodRevenue = periodInvoices.reduce((sum, i) => addMoney(sum, i.amount), 0);
    const periodReceived = periodReceipts.reduce((sum, r) => addMoney(sum, r.amount), 0);
    const periodPurchasesTotal = periodPurchases.reduce((sum, p) => addMoney(sum, p.amount), 0);
    const periodDirectExpensesTotal = periodExpenses.reduce((sum, e) => addMoney(sum, e.amount), 0);
    const periodVendorPaid = periodPayments
      .filter((p) => p.paymentFor === 'purchase')
      .reduce((sum, p) => addMoney(sum, p.amount), 0);
    const periodTotalCost = addMoney(periodPurchasesTotal, periodDirectExpensesTotal);
    const periodGrossProfit = subtractMoney(periodRevenue, periodTotalCost);
    const periodMargin = periodRevenue > 0 ? (periodGrossProfit / periodRevenue) * 100 : 0;

    // Liquid funds (Bank + Cash + Petty Cash)
    const bankBalance = state.bankAccounts.reduce(
      (sum, b) => (b.status === 'active' ? addMoney(sum, b.currentBalance) : sum),
      0
    );
    const cashBalance = state.cashAccounts.reduce(
      (sum, c) => (c.status === 'active' ? addMoney(sum, c.currentBalance) : sum),
      0
    );
    const pettyCashBalance = state.pettyCashAccounts.reduce(
      (sum, p) => (p.status === 'active' ? addMoney(sum, p.currentBalance) : sum),
      0
    );
    const totalLiquidFunds = addMoney(addMoney(bankBalance, cashBalance), pettyCashBalance);

    // Working Capital = Liquid Funds + Total Receivables - Total Payables
    const workingCapital = subtractMoney(addMoney(totalLiquidFunds, cumReceivable), cumPayable);

    // Collection efficiency ratio
    const collectionEfficiency = cumRevenue > 0 ? (cumReceived / cumRevenue) * 100 : 0;

    // Contract values & Budget targets
    let targetContractValue = 0;
    let targetBudgetCost = 0;
    if (scope === 'project' && currentProject) {
      targetContractValue = currentProject.contractValue || 0;
      targetBudgetCost =
        currentProject.budgetCost || Math.round(targetContractValue * 0.75 * 1000) / 1000;
    } else {
      targetContractValue = projects.reduce((sum, p) => addMoney(sum, p.contractValue), 0);
      targetBudgetCost = projects.reduce(
        (sum, p) => addMoney(sum, p.budgetCost || p.contractValue * 0.75),
        0
      );
    }

    const costVariance = subtractMoney(targetBudgetCost, cumTotalCost); // positive means under budget
    const budgetUtilization = targetBudgetCost > 0 ? (cumTotalCost / targetBudgetCost) * 100 : 0;
    const billingProgress = targetContractValue > 0 ? (cumRevenue / targetContractValue) * 100 : 0;

    // Net Cash Flow: Cash Collected - (Vendor Paid + Direct Expenses)
    const totalCashDisbursed = addMoney(cumVendorPaid, cumDirectExpenses);
    const netCashFlow = subtractMoney(cumReceived, totalCashDisbursed);

    return {
      cumRevenue,
      cumReceived,
      cumPurchases,
      cumDirectExpenses,
      cumTotalCost,
      cumGrossProfit,
      cumMargin,
      cumReceivable,
      cumPayable,
      periodRevenue,
      periodReceived,
      periodPurchases: periodPurchasesTotal,
      periodDirectExpenses: periodDirectExpensesTotal,
      periodTotalCost,
      periodGrossProfit,
      periodMargin,
      totalLiquidFunds,
      bankBalance,
      cashBalance,
      pettyCashBalance,
      workingCapital,
      collectionEfficiency,
      targetContractValue,
      targetBudgetCost,
      costVariance,
      budgetUtilization,
      billingProgress,
      netCashFlow,
      relevantInvoices,
      relevantPurchases,
      relevantExpenses,
      relevantReceipts,
      relevantPayments,
    };
  }, [state, scope, selectedProjectId, currentProject, dateRange, projects]);

  // Monthly Trend Chart Data (Last 6 Months grouped)
  const monthlyTrendData: MonthlyTrendPoint[] = useMemo(() => {
    const monthsMap = new Map<string, { revenue: number; cost: number; collections: number }>();

    // Helper to format date into "MMM yyyy"
    const getMonthKey = (dStr: string) => {
      if (!dStr) return null;
      const d = new Date(dStr.includes('T') ? dStr.split('T')[0] : dStr);
      return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    };

    // Populate months with zero
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const past = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = past.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthsMap.set(key, { revenue: 0, cost: 0, collections: 0 });
    }

    analyticsData.relevantInvoices.forEach((inv) => {
      const k = getMonthKey(inv.date);
      if (k && monthsMap.has(k)) {
        const cur = monthsMap.get(k)!;
        cur.revenue = addMoney(cur.revenue, inv.amount);
      }
    });

    analyticsData.relevantPurchases.forEach((p) => {
      const k = getMonthKey(p.date);
      if (k && monthsMap.has(k)) {
        const cur = monthsMap.get(k)!;
        cur.cost = addMoney(cur.cost, p.amount);
      }
    });

    analyticsData.relevantExpenses.forEach((e) => {
      const k = getMonthKey(e.expenseDate);
      if (k && monthsMap.has(k)) {
        const cur = monthsMap.get(k)!;
        cur.cost = addMoney(cur.cost, e.amount);
      }
    });

    analyticsData.relevantReceipts.forEach((r) => {
      const k = getMonthKey(r.transactionDate);
      if (k && monthsMap.has(k)) {
        const cur = monthsMap.get(k)!;
        cur.collections = addMoney(cur.collections, r.amount);
      }
    });

    const result: MonthlyTrendPoint[] = [];
    monthsMap.forEach((val, month) => {
      const profit = subtractMoney(val.revenue, val.cost);
      const margin = val.revenue > 0 ? (profit / val.revenue) * 100 : 0;
      result.push({
        month,
        revenue: val.revenue,
        cost: val.cost,
        collections: val.collections,
        margin,
      });
    });

    return result;
  }, [analyticsData]);

  // Cost Structure Donut Chart Data
  const costDistributionData: CostCategoryPoint[] = useMemo(() => {
    const items: CostCategoryPoint[] = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

    // Vendor Purchases (Materials & Subcontractors)
    if (analyticsData.cumPurchases > 0) {
      items.push({
        name: 'Vendor Materials & Subs',
        value: analyticsData.cumPurchases,
        color: '#3b82f6',
      });
    }

    // Direct Site Expenses grouped by head
    const expHeadMap = new Map<string, number>();
    analyticsData.relevantExpenses.forEach((e) => {
      const head = e.expenseHeadName || 'Direct Site Expense';
      const cur = expHeadMap.get(head) || 0;
      expHeadMap.set(head, addMoney(cur, e.amount));
    });

    let cIdx = 1;
    expHeadMap.forEach((amt, name) => {
      items.push({
        name,
        value: amt,
        color: colors[cIdx % colors.length],
      });
      cIdx++;
    });

    if (items.length === 0) {
      items.push({ name: 'No Cost Recorded', value: 1, color: '#94a3b8' });
    }

    return items;
  }, [analyticsData]);

  // Project Margins Bar Chart Data
  const projectMarginsData: ProjectMarginPoint[] = useMemo(() => {
    if (scope === 'project' && currentProject) {
      // In project mode: show the lifecycle financial progression
      return [
        {
          name: 'Target Contract',
          code: 'Contract',
          contract: currentProject.contractValue,
          revenue: currentProject.contractValue,
          cost: 0,
          profit: currentProject.contractValue,
          margin: 100,
        },
        {
          name: 'Invoiced IPC',
          code: 'Invoiced',
          contract: currentProject.contractValue,
          revenue: analyticsData.cumRevenue,
          cost: 0,
          profit: analyticsData.cumRevenue,
          margin: (analyticsData.cumRevenue / (currentProject.contractValue || 1)) * 100,
        },
        {
          name: 'Actual Cost',
          code: 'Actual Cost',
          contract: currentProject.contractValue,
          revenue: 0,
          cost: analyticsData.cumTotalCost,
          profit: analyticsData.cumTotalCost,
          margin: 0,
        },
        {
          name: 'Cash Collected',
          code: 'Cash Recvd',
          contract: currentProject.contractValue,
          revenue: analyticsData.cumReceived,
          cost: 0,
          profit: analyticsData.cumReceived,
          margin: (analyticsData.cumReceived / (analyticsData.cumRevenue || 1)) * 100,
        },
        {
          name: 'Gross Profit',
          code: 'Gross Profit',
          contract: currentProject.contractValue,
          revenue: analyticsData.cumRevenue,
          cost: analyticsData.cumTotalCost,
          profit: Math.max(0, analyticsData.cumGrossProfit),
          margin: analyticsData.cumMargin,
        },
      ];
    }

    // In overall mode: Rank all projects by profit
    return allProfitabilities
      .map((p) => ({
        name: p.projectName,
        code: p.projectCode,
        contract: p.contractValue,
        revenue: p.totalInvoiced,
        cost: p.totalProjectCost,
        profit: p.grossProfit,
        margin: p.profitMargin,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [scope, currentProject, analyticsData, allProfitabilities]);

  // Budget vs Actuals Chart Data
  const budgetVsActualsData: BudgetVariancePoint[] = useMemo(() => {
    if (scope === 'project' && currentProject) {
      return [
        {
          name: currentProject.code,
          Budget: analyticsData.targetBudgetCost,
          Actual: analyticsData.cumTotalCost,
          Variance: analyticsData.costVariance,
        },
      ];
    }

    // Consolidated projects comparison (top 6 projects)
    return projects.slice(0, 6).map((p) => {
      const prof = accountingService.getProjectProfitability(p.id);
      const bCost = p.budgetCost || p.contractValue * 0.75;
      return {
        name: p.code,
        Budget: bCost,
        Actual: prof.totalProjectCost,
        Variance: subtractMoney(bCost, prof.totalProjectCost),
      };
    });
  }, [scope, currentProject, analyticsData, projects]);

  // Filtered transactions for the ledger stream
  const allTransactions = useMemo(() => {
    return accountingService.getAllTransactions();
  }, [state]);

  const filteredTransactions = useMemo(() => {
    return allTransactions
      .filter((txn) => {
        // Scope filter
        if (scope === 'project' && selectedProjectId && txn.projectId !== selectedProjectId) {
          return false;
        }
        // Period filter
        if (dateRange.startDate || dateRange.endDate) {
          if (!isDateInRange(txn.date, dateRange.startDate, dateRange.endDate)) return false;
        }
        // Type filter
        if (txnFilterType !== 'all' && txn.type !== txnFilterType) return false;
        // Search term
        if (!txnSearchTerm) return true;
        const term = txnSearchTerm.toLowerCase();
        return (
          txn.description.toLowerCase().includes(term) ||
          txn.documentRef.toLowerCase().includes(term) ||
          (txn.customerName && txn.customerName.toLowerCase().includes(term)) ||
          (txn.vendorName && txn.vendorName.toLowerCase().includes(term)) ||
          (txn.projectName && txn.projectName.toLowerCase().includes(term))
        );
      })
      .slice(0, 15);
  }, [allTransactions, scope, selectedProjectId, dateRange, txnFilterType, txnSearchTerm]);

  // Risk and Watchlist items
  const projectsAtRisk = useMemo(() => {
    return allProfitabilities.filter((p) => p.profitMargin < 10 || p.grossProfit < 0);
  }, [allProfitabilities]);

  // Pending items counts
  const pendingApprovalsCount = useMemo(() => {
    const invCount = state.clientInvoices.filter((i) => i.status === 'submitted').length;
    const purCount = state.purchases.filter((p) => p.status === 'submitted').length;
    const expCount = state.directExpenses.filter((e) => e.status === 'submitted').length;
    return invCount + purCount + expCount;
  }, [state]);

  // Export Analytics to Excel
  const handleExportDashboard = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename =
      scope === 'project' && currentProject
        ? `Dashboard_${currentProject.code}_${dateRange.label.replace(/\s+/g, '_')}_${dateStr}`
        : `Dashboard_Overall_${dateRange.label.replace(/\s+/g, '_')}_${dateStr}`;

    const data = allProfitabilities.map((p) => ({
      'Project Code': p.projectCode,
      'Project Name': p.projectName,
      'Customer / Client': p.customerName,
      'Contract Value (OMR)': p.contractValue,
      'Invoiced Revenue (OMR)': p.totalInvoiced,
      'Cash Received (OMR)': p.totalReceived,
      'Outstanding Client AR (OMR)': p.outstandingReceivable,
      'Purchases (OMR)': p.totalPurchases,
      'Direct Site Expenses (OMR)': p.totalExpenses,
      'Total Project Cost (OMR)': p.totalProjectCost,
      'Gross Profit (OMR)': p.grossProfit,
      'Profit Margin (%)': `${p.profitMargin.toFixed(2)}%`,
    }));

    exportToExcel({
      filename,
      sheetName: 'Dashboard Analytics',
      title:
        scope === 'project' && currentProject
          ? `PROJECT EXECUTIVE DASHBOARD: ${currentProject.name.toUpperCase()} (${currentProject.code})`
          : `CONSOLIDATED FINANCIAL DASHBOARD & PROJECT PERFORMANCE`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Sultanate of Oman',
      currency: 'OMR',
      data,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Dashboard Filter Bar (Scope Switcher, Period Selector & Actions) */}
      <DashboardFilterBar
        scope={scope}
        onScopeChange={(newScope) => setScope(newScope)}
        selectedProjectId={selectedProjectId}
        onSelectProjectId={(pId) => setSelectedProjectId(pId)}
        projects={projects}
        datePreset={datePreset}
        onDatePresetChange={(p) => setDatePreset(p)}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onCustomStartChange={(val) => setCustomStartDate(val)}
        onCustomEndChange={(val) => setCustomEndDate(val)}
        periodLabel={dateRange.label}
        onResetFilters={handleResetFilters}
        isFilterActive={isFilterActive}
        onExportExcel={handleExportDashboard}
        onOpenClientInvoice={onOpenClientInvoice}
        onOpenPurchase={onOpenPurchase}
        onOpenExpense={onOpenExpense}
        onOpenMoneyIn={onOpenMoneyIn}
        onOpenMoneyOut={onOpenMoneyOut}
        onOpenTransfer={onOpenTransfer}
      />

      {/* 2. Primary Executive KPI Cards Grid (Scope & Period Dynamic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI Card 1: Treasury Liquid Funds / Contract Target */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {scope === 'overall' ? 'Liquid Funds (Treasury)' : 'Contract Value'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              {scope === 'overall' ? <Landmark className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
            {formatOMR(scope === 'overall' ? analyticsData.totalLiquidFunds : analyticsData.targetContractValue)}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
            {scope === 'overall' ? (
              <>
                <span>Bank: {formatOMR(analyticsData.bankBalance)}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Cash: {formatOMR(analyticsData.cashBalance + analyticsData.pettyCashBalance)}
                </span>
              </>
            ) : (
              <>
                <span>Billing Progress</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {formatPercent(analyticsData.billingProgress)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* KPI Card 2: Client Receivables & Billing */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {datePreset === 'all' ? 'Client Receivables' : 'Period Invoiced'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight font-mono">
            {formatOMR(datePreset === 'all' ? analyticsData.cumReceivable : analyticsData.periodRevenue)}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <span>Collected: {formatOMR(analyticsData.cumReceived)}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              Eff: {formatPercent(analyticsData.collectionEfficiency)}
            </span>
          </div>
        </div>

        {/* KPI Card 3: Vendor Payables / Budget Tracking */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {scope === 'overall' ? 'Vendor Payables' : 'Budget vs Actual'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight font-mono">
            {formatOMR(scope === 'overall' ? analyticsData.cumPayable : analyticsData.cumTotalCost)}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
            {scope === 'overall' ? (
              <>
                <span>Purchases: {formatOMR(analyticsData.cumPurchases)}</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Direct Exp: {formatOMR(analyticsData.cumDirectExpenses)}
                </span>
              </>
            ) : (
              <>
                <span>Budget: {formatOMR(analyticsData.targetBudgetCost)}</span>
                <span
                  className={`font-semibold px-1.5 py-0.5 rounded ${
                    analyticsData.costVariance >= 0
                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                      : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60'
                  }`}
                >
                  {analyticsData.costVariance >= 0 ? 'Under Budget' : 'Overrun'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* KPI Card 4: Net Project Profit & Profit Margin */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {datePreset === 'all' ? 'Net Project Profit' : 'Period Gross Profit'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-bold tracking-tight font-mono ${
              (datePreset === 'all' ? analyticsData.cumGrossProfit : analyticsData.periodGrossProfit) >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatOMR(datePreset === 'all' ? analyticsData.cumGrossProfit : analyticsData.periodGrossProfit)}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <span>Cost: {formatOMR(datePreset === 'all' ? analyticsData.cumTotalCost : analyticsData.periodTotalCost)}</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                (datePreset === 'all' ? analyticsData.cumMargin : analyticsData.periodMargin) >= 15
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : (datePreset === 'all' ? analyticsData.cumMargin : analyticsData.periodMargin) >= 8
                  ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              Margin: {formatPercent(datePreset === 'all' ? analyticsData.cumMargin : analyticsData.periodMargin)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Operational Financial Health Strip (Working Capital, Efficiency, Risk) */}
      <div className="bg-slate-50/90 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Working Capital */}
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Working Capital</span>
            <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
              {formatOMR(analyticsData.workingCapital)}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {analyticsData.workingCapital >= 0 ? 'Healthy Liquidity' : 'Liquidity Pressure'}
            </span>
          </div>

          {/* Collection Efficiency */}
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Collection Rate</span>
            <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
              {formatPercent(analyticsData.collectionEfficiency)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Cash / Billed Ratio</span>
          </div>

          {/* Budget Utilization */}
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Budget Incurred</span>
            <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
              {formatPercent(analyticsData.budgetUtilization)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Of Baseline Target</span>
          </div>

          {/* Net Cash Flow */}
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Net Cash Realized</span>
            <span
              className={`text-sm font-bold font-mono mt-1 block ${
                analyticsData.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatOMR(analyticsData.netCashFlow)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Recvd - Disbursed</span>
          </div>

          {/* Projects at Risk Indicator */}
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Watchlist Projects</span>
            <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block flex items-center gap-1.5">
              <span>{projectsAtRisk.length}</span>
              {projectsAtRisk.length > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 font-semibold">
                  Low Margin
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Margin &lt; 10%</span>
          </div>

          {/* Pending Approvals Queue */}
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Pending Approvals</span>
            <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
              {pendingApprovalsCount} Items
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">IPCs, Bills &amp; Expenses</span>
          </div>
        </div>
      </div>

      {/* 4. Interactive Analytics Charts (Monthly Trend, Cost Donut, Project Margins, Budget) */}
      <DashboardAnalyticsCharts
        scope={scope}
        projectName={currentProject?.name}
        projectCode={currentProject?.code}
        monthlyTrend={monthlyTrendData}
        costDistribution={costDistributionData}
        projectMargins={projectMarginsData}
        budgetVsActuals={budgetVsActualsData}
        totalProjectCost={analyticsData.cumTotalCost}
      />

      {/* 5. Forward-looking Cash Flow Projection (Next 30, 60, 90 Days) */}
      <CashFlowProjectionCard
        state={state}
        currentLiquidBalance={analyticsData.totalLiquidFunds}
      />

      {/* 6. Scope-Specific Drilldown: Overall Project Matrix OR Project Executive Brief */}
      {scope === 'overall' ? (
        /* Overall: Full Project Financial Performance Matrix */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Project Financial Performance &amp; Profitability Matrix</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Strict double-entry accounting: Project Cost = Purchases + Direct Site Expenses (Zero vendor payment double-counting)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportDashboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export Matrix</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4 text-right">Contract</th>
                  <th className="py-3 px-4 text-right">Invoiced (Rev)</th>
                  <th className="py-3 px-4 text-right">Received</th>
                  <th className="py-3 px-4 text-right">Receivable</th>
                  <th className="py-3 px-4 text-right">Purchases</th>
                  <th className="py-3 px-4 text-right">Expenses</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                  <th className="py-3 px-4 text-right">Gross Profit</th>
                  <th className="py-3 px-4 text-right">Margin</th>
                  <th className="py-3 px-4 text-center">Analytics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allProfitabilities.map((p) => (
                  <tr key={p.projectId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(p.projectId);
                          setScope('project');
                          if (onSelectProject) onSelectProject(p.projectId);
                        }}
                        className="text-slate-900 dark:text-slate-100 font-semibold hover:text-blue-600 dark:hover:text-blue-400 text-left cursor-pointer flex items-center gap-1 group"
                      >
                        <span>{p.projectName}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">{p.projectCode}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{p.customerName || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatOMR(p.contractValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                      {formatOMR(p.totalInvoiced)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatOMR(p.totalReceived)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-400 font-medium">
                      {formatOMR(p.outstandingReceivable)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatOMR(p.totalPurchases)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatOMR(p.totalExpenses)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                      {formatOMR(p.totalProjectCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatOMR(p.grossProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          p.profitMargin >= 15
                            ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : p.profitMargin >= 8
                            ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {formatPercent(p.profitMargin)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(p.projectId);
                          setScope('project');
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-900 transition-colors cursor-pointer"
                      >
                        Drilldown
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Project Mode: Project Executive Brief Card & Sub-Ledger */
        currentProject && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 space-y-4 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {currentProject.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {currentProject.code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 capitalize">
                    {currentProject.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Client: <strong className="text-slate-700 dark:text-slate-300">{currentProject.customerName || 'N/A'}</strong> &bull; Start Date: {currentProject.startDate}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setScope('overall');
                  setSelectedProjectId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <span>&larr; Back to Overall View</span>
              </button>
            </div>

            {/* Quick Summary Grid for Selected Project */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Contract Value</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
                  {formatOMR(currentProject.contractValue)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Approved Budget Cost</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
                  {formatOMR(analyticsData.targetBudgetCost)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Cost Incurred to Date</span>
                <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                  {formatOMR(analyticsData.cumTotalCost)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Cost Variance (Under/Over)</span>
                <span
                  className={`text-sm font-bold font-mono mt-1 block ${
                    analyticsData.costVariance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatOMR(analyticsData.costVariance)}
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {/* 7. Multi-Ledger Transactions Stream (Filterable & Reversible) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Recent Accounting Transactions &amp; Audit Trail
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live double-entry postings linked to active scope with document attachments and 1-click reversal
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={txnFilterType}
              onChange={(e) => setTxnFilterType(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Transaction Types</option>
              <option value="CLIENT_INVOICE">Client Invoices / IPC</option>
              <option value="PURCHASE">Vendor Purchases</option>
              <option value="EXPENSE">Direct Site Expenses</option>
              <option value="MONEY_IN">Money In (Receipts)</option>
              <option value="MONEY_OUT">Money Out (Payments)</option>
              <option value="TRANSFER">Bank Transfers</option>
            </select>

            <input
              type="text"
              placeholder="Search ref, party, desc..."
              value={txnSearchTerm}
              onChange={(e) => setTxnSearchTerm(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none w-36 sm:w-48"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Doc Ref</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Party / Account</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.map((txn) => {
                const isReversed = txn.status === 'reversed';
                return (
                  <tr
                    key={txn.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                      isReversed ? 'bg-slate-50/50 dark:bg-slate-800/20 opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {txn.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-medium text-slate-800 dark:text-slate-200">
                      {txn.documentRef}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          txn.type === 'MONEY_IN'
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : txn.type === 'MONEY_OUT'
                            ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : txn.type === 'CLIENT_INVOICE'
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : txn.type === 'PURCHASE'
                            ? 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                            : txn.type === 'EXPENSE'
                            ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}
                      >
                        {txn.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {txn.projectName ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (txn.projectId) {
                              setSelectedProjectId(txn.projectId);
                              setScope('project');
                              if (onSelectProject) onSelectProject(txn.projectId);
                            }
                          }}
                          className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium"
                        >
                          {txn.projectName}
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {txn.customerName || txn.vendorName || txn.accountName || '—'}
                    </td>
                    <td
                      className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400"
                      title={txn.description}
                    >
                      {txn.description}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatOMR(txn.amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isReversed ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                          Reversed
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          Posted
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {txn.attachmentUrl && (
                          <a
                            href={txn.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded cursor-pointer"
                            title="View Supporting Attachment"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {!isReversed && onReverseTransaction && (
                          <button
                            type="button"
                            onClick={() => onReverseTransaction(txn)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded cursor-pointer"
                            title="Reverse Transaction"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                    No transactions match your search criteria.
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

export default DashboardView;
