import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Building2,
  DollarSign,
  Landmark,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Truck,
  BarChart3,
  Activity,
  Palette,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { accountingService } from '../../services/accountingService';
import { formatOMR, formatPercent, addMoney, subtractMoney } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import { Transaction } from '../../types';
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

export interface TrendPalette {
  id: string;
  name: string;
  desc: string;
  revenue: {
    from: string;
    to: string;
    solid: string;
    stroke: string;
    cardBg: string;
    cardBorder: string;
    cardText: string;
  };
  cost: {
    from: string;
    to: string;
    solid: string;
    stroke: string;
    cardBg: string;
    cardBorder: string;
    cardText: string;
  };
  profit: {
    line: string;
    dot: string;
    cardBg: string;
    cardBorder: string;
    cardText: string;
  };
  purchases: {
    from: string;
    to: string;
    solid: string;
  };
  directExpenses: {
    from: string;
    to: string;
    solid: string;
  };
}

export const TREND_PALETTES: Record<string, TrendPalette> = {
  royal_amber: {
    id: 'royal_amber',
    name: 'Executive Amber',
    desc: 'Royal Blue Revenue & Warm Amber Cost',
    revenue: {
      from: '#2563eb',
      to: '#1d4ed8',
      solid: '#2563eb',
      stroke: '#1d4ed8',
      cardBg: 'bg-blue-50/50 dark:bg-blue-950/20',
      cardBorder: 'border-blue-100 dark:border-blue-900/40',
      cardText: 'text-blue-600 dark:text-blue-400',
    },
    cost: {
      from: '#f59e0b',
      to: '#d97706',
      solid: '#f59e0b',
      stroke: '#d97706',
      cardBg: 'bg-amber-50/50 dark:bg-amber-950/20',
      cardBorder: 'border-amber-100 dark:border-amber-900/40',
      cardText: 'text-amber-600 dark:text-amber-400',
    },
    profit: {
      line: '#10b981',
      dot: '#10b981',
      cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      cardBorder: 'border-emerald-100 dark:border-emerald-900/40',
      cardText: 'text-emerald-600 dark:text-emerald-400',
    },
    purchases: {
      from: '#b45309',
      to: '#78350f',
      solid: '#b45309',
    },
    directExpenses: {
      from: '#8b5cf6',
      to: '#6d28d9',
      solid: '#8b5cf6',
    },
  },
  cyan_terracotta: {
    id: 'cyan_terracotta',
    name: 'Blueprint Terracotta',
    desc: 'Deep Cyan Revenue & Earthy Terracotta Cost',
    revenue: {
      from: '#0284c7',
      to: '#0369a1',
      solid: '#0284c7',
      stroke: '#0369a1',
      cardBg: 'bg-cyan-50/50 dark:bg-cyan-950/20',
      cardBorder: 'border-cyan-100 dark:border-cyan-900/40',
      cardText: 'text-cyan-600 dark:text-cyan-400',
    },
    cost: {
      from: '#ea580c',
      to: '#c2410c',
      solid: '#ea580c',
      stroke: '#c2410c',
      cardBg: 'bg-orange-50/50 dark:bg-orange-950/20',
      cardBorder: 'border-orange-100 dark:border-orange-900/40',
      cardText: 'text-orange-600 dark:text-orange-400',
    },
    profit: {
      line: '#059669',
      dot: '#059669',
      cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      cardBorder: 'border-emerald-100 dark:border-emerald-900/40',
      cardText: 'text-emerald-600 dark:text-emerald-400',
    },
    purchases: {
      from: '#d97706',
      to: '#b45309',
      solid: '#d97706',
    },
    directExpenses: {
      from: '#6366f1',
      to: '#4f46e5',
      solid: '#6366f1',
    },
  },
  emerald_slate: {
    id: 'emerald_slate',
    name: 'Emerald & Slate',
    desc: 'Forest Jade Revenue & Slate Stone Cost',
    revenue: {
      from: '#059669',
      to: '#047857',
      solid: '#059669',
      stroke: '#047857',
      cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      cardBorder: 'border-emerald-100 dark:border-emerald-900/40',
      cardText: 'text-emerald-600 dark:text-emerald-400',
    },
    cost: {
      from: '#64748b',
      to: '#475569',
      solid: '#64748b',
      stroke: '#475569',
      cardBg: 'bg-slate-100/70 dark:bg-slate-800/50',
      cardBorder: 'border-slate-200 dark:border-slate-700',
      cardText: 'text-slate-700 dark:text-slate-300',
    },
    profit: {
      line: '#d97706',
      dot: '#d97706',
      cardBg: 'bg-amber-50/50 dark:bg-amber-950/20',
      cardBorder: 'border-amber-100 dark:border-amber-900/40',
      cardText: 'text-amber-600 dark:text-amber-400',
    },
    purchases: {
      from: '#475569',
      to: '#334155',
      solid: '#475569',
    },
    directExpenses: {
      from: '#0284c7',
      to: '#0369a1',
      solid: '#0284c7',
    },
  },
  indigo_coral: {
    id: 'indigo_coral',
    name: 'Indigo & Coral',
    desc: 'Deep Indigo Revenue & Coral Pink Cost',
    revenue: {
      from: '#4f46e5',
      to: '#3730a3',
      solid: '#4f46e5',
      stroke: '#3730a3',
      cardBg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
      cardBorder: 'border-indigo-100 dark:border-indigo-900/40',
      cardText: 'text-indigo-600 dark:text-indigo-400',
    },
    cost: {
      from: '#f43f5e',
      to: '#be123c',
      solid: '#f43f5e',
      stroke: '#be123c',
      cardBg: 'bg-rose-50/50 dark:bg-rose-950/20',
      cardBorder: 'border-rose-100 dark:border-rose-900/40',
      cardText: 'text-rose-600 dark:text-rose-400',
    },
    profit: {
      line: '#10b981',
      dot: '#10b981',
      cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      cardBorder: 'border-emerald-100 dark:border-emerald-900/40',
      cardText: 'text-emerald-600 dark:text-emerald-400',
    },
    purchases: {
      from: '#f59e0b',
      to: '#b45309',
      solid: '#f59e0b',
    },
    directExpenses: {
      from: '#8b5cf6',
      to: '#6d28d9',
      solid: '#8b5cf6',
    },
  },
};

const CustomMonthlyTooltip = ({ active, payload, label, palette }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const activePal: TrendPalette = palette || TREND_PALETTES.royal_amber;

  return (
    <div className="bg-slate-900/95 backdrop-blur-xs border border-slate-700/90 rounded-xl p-3.5 shadow-2xl text-slate-100 min-w-[250px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
        <span className="font-semibold text-xs text-slate-200">{data.monthLabel || label}</span>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
            data.netProfit >= 0
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}
        >
          {data.marginPercent.toFixed(1)}% Margin
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: activePal.revenue.solid }} />
            Invoiced Revenue:
          </span>
          <span className="font-mono font-bold" style={{ color: activePal.revenue.solid }}>{formatOMR(data.revenue)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: activePal.cost.solid }} />
            Total Project Cost:
          </span>
          <span className="font-mono font-bold" style={{ color: activePal.cost.solid }}>{formatOMR(data.totalExpenses)}</span>
        </div>
        {data.purchases > 0 && (
          <div className="flex items-center justify-between pl-4 text-[11px] text-slate-400">
            <span>• Purchases &amp; Materials:</span>
            <span className="font-mono" style={{ color: activePal.purchases.solid }}>{formatOMR(data.purchases)}</span>
          </div>
        )}
        {data.directExpenses > 0 && (
          <div className="flex items-center justify-between pl-4 text-[11px] text-slate-400">
            <span>• Direct Site Expenses:</span>
            <span className="font-mono" style={{ color: activePal.directExpenses.solid }}>{formatOMR(data.directExpenses)}</span>
          </div>
        )}
        <div className="border-t border-slate-800 pt-1.5 mt-1 flex items-center justify-between">
          <span className="text-slate-300 font-medium">Net Operating Profit:</span>
          <span
            className={`font-mono font-bold ${
              data.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatOMR(data.netProfit)}
          </span>
        </div>
        {(data.cashIn > 0 || data.cashOut > 0) && (
          <div className="border-t border-slate-800/60 pt-1.5 text-[10px] text-slate-400 flex justify-between">
            <span>Cash In: <strong className="text-emerald-400 font-mono">{formatOMR(data.cashIn)}</strong></span>
            <span>Cash Out: <strong className="text-amber-400 font-mono">{formatOMR(data.cashOut)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};

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
  onSelectCustomer: _onSelectCustomer,
  onSelectVendor: _onSelectVendor,
  onReverseTransaction,
  onNavigateToProjectsList: _onNavigateToProjectsList,
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

  // Recharts Interactive Controls for Monthly Revenue & Expense Trends
  const [trendChartType, setTrendChartType] = useState<'bar' | 'area' | 'line'>('bar');
  const [trendTimeframe, setTrendTimeframe] = useState<'6m' | '12m' | 'all'>('6m');
  const [trendMetricView, setTrendMetricView] = useState<'combined' | 'detailed' | 'cashflow'>('combined');
  const [showProfitOverlay, setShowProfitOverlay] = useState<boolean>(true);
  const [trendPaletteId, setTrendPaletteId] = useState<string>('royal_amber');
  const [showPaletteMenu, setShowPaletteMenu] = useState<boolean>(false);
  const activePalette = TREND_PALETTES[trendPaletteId] || TREND_PALETTES.royal_amber;

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
      periodVendorPaid,
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

  // All recorded transactions from accountingService engine
  const allTransactions = useMemo(() => {
    return accountingService.getAllTransactions();
  }, [state]);

  // Monthly Revenue & Expense trends calculated directly from existing transaction data in accountingService
  const monthlyRevenueExpenseTrends = useMemo(() => {
    // Exclude reversed transactions
    const validTransactions = allTransactions.filter((txn) => {
      if (txn.status === 'reversed') return false;
      if (scope === 'project' && selectedProjectId && txn.projectId !== selectedProjectId) {
        return false;
      }
      return true;
    });

    const now = new Date();
    const monthsCount = trendTimeframe === '12m' ? 12 : trendTimeframe === 'all' ? 18 : 6;
    const monthsMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      revenue: number;
      purchases: number;
      directExpenses: number;
      totalExpenses: number;
      netProfit: number;
      marginPercent: number;
      cashIn: number;
      cashOut: number;
      invoiceCount: number;
      expenseCount: number;
      txnCount: number;
    }>();

    // Pre-populate chronological months up to current date
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthsMap.set(key, {
        monthKey: key,
        monthLabel: label,
        revenue: 0,
        purchases: 0,
        directExpenses: 0,
        totalExpenses: 0,
        netProfit: 0,
        marginPercent: 0,
        cashIn: 0,
        cashOut: 0,
        invoiceCount: 0,
        expenseCount: 0,
        txnCount: 0,
      });
    }

    // Process all valid transactions
    validTransactions.forEach((txn) => {
      if (!txn.date) return;
      const cleanDate = txn.date.includes('T') ? txn.date.split('T')[0] : txn.date;
      const parts = cleanDate.split('-');
      if (parts.length < 2) return;
      const key = `${parts[0]}-${parts[1].padStart(2, '0')}`;

      if (!monthsMap.has(key)) {
        if (trendTimeframe === 'all' || trendTimeframe === '12m') {
          const d = new Date(`${key}-01`);
          const label = !isNaN(d.getTime())
            ? d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
            : key;
          monthsMap.set(key, {
            monthKey: key,
            monthLabel: label,
            revenue: 0,
            purchases: 0,
            directExpenses: 0,
            totalExpenses: 0,
            netProfit: 0,
            marginPercent: 0,
            cashIn: 0,
            cashOut: 0,
            invoiceCount: 0,
            expenseCount: 0,
            txnCount: 0,
          });
        } else {
          return;
        }
      }

      const item = monthsMap.get(key)!;
      item.txnCount += 1;
      const amt = Number(txn.amount) || 0;

      if (txn.type === 'CLIENT_INVOICE') {
        item.revenue = addMoney(item.revenue, amt);
        item.invoiceCount += 1;
      } else if (txn.type === 'PURCHASE') {
        item.purchases = addMoney(item.purchases, amt);
        item.totalExpenses = addMoney(item.totalExpenses, amt);
        item.expenseCount += 1;
      } else if (txn.type === 'EXPENSE') {
        item.directExpenses = addMoney(item.directExpenses, amt);
        item.totalExpenses = addMoney(item.totalExpenses, amt);
        item.expenseCount += 1;
      } else if (txn.type === 'MONEY_IN') {
        item.cashIn = addMoney(item.cashIn, amt);
      } else if (txn.type === 'MONEY_OUT') {
        item.cashOut = addMoney(item.cashOut, amt);
      }
    });

    const sorted = Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return sorted.map((m) => {
      const netProfit = subtractMoney(m.revenue, m.totalExpenses);
      const marginPercent = m.revenue > 0 ? (netProfit / m.revenue) * 100 : 0;
      return {
        ...m,
        netProfit,
        marginPercent,
      };
    });
  }, [allTransactions, scope, selectedProjectId, trendTimeframe]);

  // Aggregate Key Performance Indicators for the Trend Chart
  const trendSummary = useMemo(() => {
    const totalRev = monthlyRevenueExpenseTrends.reduce((s, m) => addMoney(s, m.revenue), 0);
    const totalExp = monthlyRevenueExpenseTrends.reduce((s, m) => addMoney(s, m.totalExpenses), 0);
    const totalPurchases = monthlyRevenueExpenseTrends.reduce((s, m) => addMoney(s, m.purchases), 0);
    const totalDirectExp = monthlyRevenueExpenseTrends.reduce((s, m) => addMoney(s, m.directExpenses), 0);
    const totalCashIn = monthlyRevenueExpenseTrends.reduce((s, m) => addMoney(s, m.cashIn), 0);
    const totalCashOut = monthlyRevenueExpenseTrends.reduce((s, m) => addMoney(s, m.cashOut), 0);
    const netProfit = subtractMoney(totalRev, totalExp);
    const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
    const activeMonths = monthlyRevenueExpenseTrends.filter((m) => m.revenue > 0 || m.totalExpenses > 0);
    const avgMonthlyRev = activeMonths.length > 0 ? totalRev / activeMonths.length : 0;
    const profitableMonths = monthlyRevenueExpenseTrends.filter((m) => m.netProfit > 0 && m.revenue > 0).length;

    return {
      totalRev,
      totalExp,
      totalPurchases,
      totalDirectExp,
      totalCashIn,
      totalCashOut,
      netProfit,
      margin,
      avgMonthlyRev,
      activeMonthsCount: activeMonths.length,
      profitableMonths,
    };
  }, [monthlyRevenueExpenseTrends]);

  // Synchronized Monthly Trend Chart Data for the downstream analytics charts
  const monthlyTrendData: MonthlyTrendPoint[] = useMemo(() => {
    return monthlyRevenueExpenseTrends.map((m) => ({
      month: m.monthLabel,
      revenue: m.revenue,
      cost: m.totalExpenses,
      collections: m.cashIn,
      margin: m.marginPercent,
    }));
  }, [monthlyRevenueExpenseTrends]);

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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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

      {/* 4. Interactive Recharts: Monthly Revenue & Expense Trends (Utilizing accountingService Transactions) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 space-y-4 transition-colors">
        {/* Header & Interactive Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Monthly Revenue &amp; Expense Trends
              </h3>
              {scope === 'project' && currentProject && (
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {currentProject.code} — {currentProject.name}
                </span>
              )}
              {scope === 'overall' && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Consolidated Enterprise
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visualizing monthly recognized revenue (Client IPCs) vs. total project costs (Purchases &amp; Direct Expenses) with net operating margins.
            </p>
          </div>

          {/* Interactive Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Metric Mode */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setTrendMetricView('combined')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  trendMetricView === 'combined'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Revenue vs Cost
              </button>
              <button
                type="button"
                onClick={() => setTrendMetricView('detailed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  trendMetricView === 'detailed'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Cost Breakdown
              </button>
              <button
                type="button"
                onClick={() => setTrendMetricView('cashflow')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  trendMetricView === 'cashflow'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Accrual vs Cash
              </button>
            </div>

            {/* Chart Type: Bar, Area, Line */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setTrendChartType('bar')}
                title="Grouped Bar Chart"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  trendChartType === 'bar'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTrendChartType('area')}
                title="Gradient Area Curves"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  trendChartType === 'area'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTrendChartType('line')}
                title="Trend Lines"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  trendChartType === 'line'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Timeframe: 6M, 12M, All */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTrendTimeframe('6m')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  trendTimeframe === '6m'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                6M
              </button>
              <button
                type="button"
                onClick={() => setTrendTimeframe('12m')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  trendTimeframe === '12m'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                12M
              </button>
              <button
                type="button"
                onClick={() => setTrendTimeframe('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  trendTimeframe === 'all'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
            </div>

            {/* Net Profit Line Overlay Toggle */}
            <button
              type="button"
              onClick={() => setShowProfitOverlay(!showProfitOverlay)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                showProfitOverlay
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showProfitOverlay ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>Profit Curve</span>
            </button>

            {/* Color Palette Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPaletteMenu(!showPaletteMenu)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors cursor-pointer"
                title="Change chart color scheme"
              >
                <Palette className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden md:inline text-slate-500 dark:text-slate-400">Palette:</span>
                <span className="font-semibold">{activePalette.name}</span>
                <div className="flex items-center -space-x-1 ml-0.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900" style={{ backgroundColor: activePalette.revenue.solid }} />
                  <span className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900" style={{ backgroundColor: activePalette.cost.solid }} />
                  <span className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900" style={{ backgroundColor: activePalette.profit.line }} />
                </div>
              </button>

              {showPaletteMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowPaletteMenu(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      Chart Color Scheme
                    </div>
                    <div className="p-1 space-y-0.5">
                      {Object.values(TREND_PALETTES).map((pal) => (
                        <button
                          key={pal.id}
                          type="button"
                          onClick={() => {
                            setTrendPaletteId(pal.id);
                            setShowPaletteMenu(false);
                          }}
                          className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer text-left ${
                            trendPaletteId === pal.id
                              ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-medium text-[12px]">{pal.name}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">{pal.desc}</div>
                          </div>
                          <div className="flex items-center -space-x-1 shrink-0 ml-2">
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-2xs" style={{ backgroundColor: pal.revenue.solid }} />
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-2xs" style={{ backgroundColor: pal.cost.solid }} />
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-2xs" style={{ backgroundColor: pal.profit.line }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick KPI Strip inside Trend Card */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className={`p-3 rounded-xl border transition-colors ${activePalette.revenue.cardBg} ${activePalette.revenue.cardBorder}`}>
            <span className={`text-[11px] font-medium block ${activePalette.revenue.cardText}`}>Period Revenue</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
              {formatOMR(trendSummary.totalRev)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Billed client progress</span>
          </div>

          <div className={`p-3 rounded-xl border transition-colors ${activePalette.cost.cardBg} ${activePalette.cost.cardBorder}`}>
            <span className={`text-[11px] font-medium block ${activePalette.cost.cardText}`}>Total Project Cost</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
              {formatOMR(trendSummary.totalExp)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Purchases &amp; site costs</span>
          </div>

          <div className={`p-3 rounded-xl border transition-colors ${activePalette.profit.cardBg} ${activePalette.profit.cardBorder}`}>
            <span className={`text-[11px] font-medium block ${activePalette.profit.cardText}`}>Net Operating Profit</span>
            <span className={`text-base font-bold font-mono mt-0.5 block ${trendSummary.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatOMR(trendSummary.netProfit)}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {trendSummary.margin.toFixed(1)}% Operating Margin
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Monthly Run Rate</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
              {formatOMR(trendSummary.avgMonthlyRev)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Avg active month billings</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Profitable Months</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
              {trendSummary.profitableMonths} / {monthlyRevenueExpenseTrends.length}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Positive margin periods</span>
          </div>
        </div>

        {/* The Recharts Container */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {trendChartType === 'bar' ? (
              <ComposedChart data={monthlyRevenueExpenseTrends} margin={{ top: 15, right: 15, left: -5, bottom: 15 }}>
                <defs>
                  <linearGradient id="colorRevBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activePalette.revenue.from} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={activePalette.revenue.to} stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="colorExpBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activePalette.cost.from} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={activePalette.cost.to} stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="colorPurBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activePalette.purchases.from} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={activePalette.purchases.to} stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="colorDirBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activePalette.directExpenses.from} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={activePalette.directExpenses.to} stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.4} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  yAxisId="amount"
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomMonthlyTooltip palette={activePalette} />} />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  iconType="circle"
                />
                <ReferenceLine yAxisId="amount" y={0} stroke="#94a3b8" />

                {trendMetricView === 'combined' && (
                  <>
                    <Bar
                      yAxisId="amount"
                      dataKey="revenue"
                      name="Invoiced Revenue"
                      fill="url(#colorRevBar)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      yAxisId="amount"
                      dataKey="totalExpenses"
                      name="Total Project Cost"
                      fill="url(#colorExpBar)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </>
                )}

                {trendMetricView === 'detailed' && (
                  <>
                    <Bar
                      yAxisId="amount"
                      dataKey="revenue"
                      name="Invoiced Revenue"
                      fill="url(#colorRevBar)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      yAxisId="amount"
                      dataKey="purchases"
                      name="Purchases &amp; Materials"
                      fill="url(#colorPurBar)"
                      stackId="expenses"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      yAxisId="amount"
                      dataKey="directExpenses"
                      name="Direct Site Expenses"
                      fill="url(#colorDirBar)"
                      stackId="expenses"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </>
                )}

                {trendMetricView === 'cashflow' && (
                  <>
                    <Bar
                      yAxisId="amount"
                      dataKey="revenue"
                      name="Billed Revenue (Accrual)"
                      fill="url(#colorRevBar)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      yAxisId="amount"
                      dataKey="cashIn"
                      name="Cash Collections (Receipts)"
                      fill="#10b981"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      yAxisId="amount"
                      dataKey="totalExpenses"
                      name="Incurred Cost (Accrual)"
                      fill="url(#colorExpBar)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      yAxisId="amount"
                      dataKey="cashOut"
                      name="Cash Payments Out"
                      fill="#f97316"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                  </>
                )}

                {showProfitOverlay && (
                  <Line
                    yAxisId="amount"
                    type="monotone"
                    dataKey="netProfit"
                    name="Net Operating Profit"
                    stroke={activePalette.profit.line}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: activePalette.profit.dot, strokeWidth: 1.5, stroke: '#ffffff' }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </ComposedChart>
            ) : trendChartType === 'area' ? (
              <AreaChart data={monthlyRevenueExpenseTrends} margin={{ top: 15, right: 15, left: -5, bottom: 15 }}>
                <defs>
                  <linearGradient id="areaRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activePalette.revenue.from} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={activePalette.revenue.from} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="areaExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activePalette.cost.from} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={activePalette.cost.from} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.4} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} dy={6} />
                <YAxis tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <Tooltip content={<CustomMonthlyTooltip palette={activePalette} />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="circle" />
                <Area type="monotone" dataKey="revenue" name="Invoiced Revenue" stroke={activePalette.revenue.stroke} strokeWidth={2.5} fillOpacity={1} fill="url(#areaRev)" />
                <Area type="monotone" dataKey="totalExpenses" name="Total Project Cost" stroke={activePalette.cost.stroke} strokeWidth={2.5} fillOpacity={1} fill="url(#areaExp)" />
                {showProfitOverlay && (
                  <Line type="monotone" dataKey="netProfit" name="Net Operating Profit" stroke={activePalette.profit.line} strokeWidth={2} dot={{ r: 4, fill: activePalette.profit.dot }} />
                )}
              </AreaChart>
            ) : (
              <LineChart data={monthlyRevenueExpenseTrends} margin={{ top: 15, right: 15, left: -5, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.4} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} dy={6} />
                <YAxis tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <Tooltip content={<CustomMonthlyTooltip palette={activePalette} />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="circle" />
                <Line type="monotone" dataKey="revenue" name="Invoiced Revenue" stroke={activePalette.revenue.stroke} strokeWidth={2.5} dot={{ r: 4, fill: activePalette.revenue.stroke }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="totalExpenses" name="Total Project Cost" stroke={activePalette.cost.stroke} strokeWidth={2.5} dot={{ r: 4, fill: activePalette.cost.stroke }} activeDot={{ r: 6 }} />
                {trendMetricView === 'detailed' && (
                  <>
                    <Line type="monotone" dataKey="purchases" name="Purchases" stroke={activePalette.purchases.solid} strokeWidth={1.8} strokeDasharray="4 4" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="directExpenses" name="Direct Site Expenses" stroke={activePalette.directExpenses.solid} strokeWidth={1.8} strokeDasharray="4 4" dot={{ r: 3 }} />
                  </>
                )}
                {showProfitOverlay && (
                  <Line type="monotone" dataKey="netProfit" name="Net Operating Profit" stroke={activePalette.profit.line} strokeWidth={2.5} dot={{ r: 4, fill: activePalette.profit.dot }} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Empty State / Helper */}
        {trendSummary.activeMonthsCount === 0 && (
          <div className="flex items-center gap-2 p-3.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>No transactions recorded in this selected scope yet. Record invoices or purchases to see trends here.</span>
          </div>
        )}
      </div>

      {/* 5. Interactive Analytics Charts (Cost Donut, Project Margins, Budget vs Actuals) */}
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
              <option value="MONEY_IN">Receipt from Client</option>
              <option value="MONEY_OUT">Payment to Vendors</option>
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
              {filteredTransactions.map((txn, idx) => {
                const isReversed = txn.status === 'reversed';
                return (
                  <tr
                    key={`${txn.type}-${txn.id}-${idx}`}
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
