import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  TrendingUp,
  BarChart3,
  Scale,
  DollarSign,
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  Filter,
  Search,
  RotateCcw,
  X,
  ArrowUpDown,
  Building2,
  AlertCircle,
  AlertTriangle,
  Percent,
  Users,
  Truck,
  Printer,
  FileText,
  FolderDown,
  Eye,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, formatPercent, addMoney } from '../../utils/formatters';
import { exportToExcel, exportToCsv, exportMultiSheetExcel } from '../../utils/exportToExcel';
import { toast } from '../../context/ToastContext';
import { ArtifyLogo } from '../ArtifyLogo';
import { TableExportButtons } from './TableExportButtons';
import { TableDensityToggle } from '../TableDensityToggle';
import { useTableDensity } from '../../context/TableDensityContext';
import { PrintPreviewModal, PrintPreviewColumn } from '../modals/PrintPreviewModal';
import {
  DatePreset,
  getDateRangeFromPreset,
  isDateInRange,
  calculateAgingDays,
  getAgingBracket,
  getAgingBadge,
  AgingBracketType,
} from '../../utils/reportFilters';

type ReportType =
  | 'profitability'
  | 'income_statement'
  | 'balance_sheet'
  | 'trial_balance'
  | 'cash_flow'
  | 'ar_aging'
  | 'ap_aging'
  | 'general_journal';

export const ReportsView: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('profitability');
  const { isCompact, cellPadding, headerPadding, fontSize } = useTableDensity();

  // -------------------------------------------------------------
  // GLOBAL QUICK FILTERS (Applicable across reports)
  // -------------------------------------------------------------
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [filterProjectId, setFilterProjectId] = useState<string>('all');

  // Compute active date range
  const dateRange = useMemo(() => {
    return getDateRangeFromPreset(datePreset, customStartDate, customEndDate);
  }, [datePreset, customStartDate, customEndDate]);

  // -------------------------------------------------------------
  // REPORT-SPECIFIC QUICK FILTERS
  // -------------------------------------------------------------
  // 1. Profitability
  const [profitMarginFilter, setProfitMarginFilter] = useState<'all' | 'high' | 'mid' | 'low' | 'loss'>('all');
  const [profitSearch, setProfitSearch] = useState<string>('');
  const [profitSort, setProfitSort] = useState<'profit_desc' | 'margin_desc' | 'contract_desc' | 'cost_desc' | 'code_asc'>('profit_desc');

  // 2. Income Statement
  const [showIncomePercent, setShowIncomePercent] = useState<boolean>(true);

  // 3. Balance Sheet
  const [balanceSheetAsOf, setBalanceSheetAsOf] = useState<'current' | 'month_end' | 'last_month_end' | 'last_quarter_end'>('current');
  const [hideZeroBalanceAccounts, setHideZeroBalanceAccounts] = useState<boolean>(false);

  // 4. Trial Balance
  const [trialAccountClass, setTrialAccountClass] = useState<'all' | 'assets' | 'liabilities' | 'revenue' | 'expenses'>('all');
  const [trialSearch, setTrialSearch] = useState<string>('');
  const [hideZeroTrial, setHideZeroTrial] = useState<boolean>(false);

  // 6. AR Aging
  const [arAgingBracket, setArAgingBracket] = useState<AgingBracketType>('all');
  const [arCustomerId, setArCustomerId] = useState<string>('all');
  const [arMinAmount, setArMinAmount] = useState<number>(0);
  const [arSearch, setArSearch] = useState<string>('');

  // 7. AP Aging
  const [apAgingBracket, setApAgingBracket] = useState<AgingBracketType>('all');
  const [apVendorId, setApVendorId] = useState<string>('all');
  const [apCategory, setApCategory] = useState<string>('all');
  const [apMinAmount, setApMinAmount] = useState<number>(0);
  const [apSearch, setApSearch] = useState<string>('');

  // 8. General Journal
  const [journalSourceType, setJournalSourceType] = useState<string>('all');
  const [journalStatus, setJournalStatus] = useState<string>('all');
  const [journalEntityTrace, setJournalEntityTrace] = useState<'all' | 'project' | 'customer' | 'vendor' | 'internal'>('all');
  const [journalSearch, setJournalSearch] = useState<string>('');

  // Multi-Record Selection States for Combined PDF Printing
  const [selectedJournalIds, setSelectedJournalIds] = useState<Set<string>>(new Set());
  const [isJournalPrintSelectedOnly, setIsJournalPrintSelectedOnly] = useState<boolean>(false);

  const [selectedArIds, setSelectedArIds] = useState<Set<string>>(new Set());
  const [isArPrintSelectedOnly, setIsArPrintSelectedOnly] = useState<boolean>(false);

  const [selectedApIds, setSelectedApIds] = useState<Set<string>>(new Set());
  const [isApPrintSelectedOnly, setIsApPrintSelectedOnly] = useState<boolean>(false);

  const [printTimestamp, setPrintTimestamp] = useState<string>('');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [previewSelectedOnly, setPreviewSelectedOnly] = useState<boolean>(false);

  const getFormattedTimestamp = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${dateStr} ${timeStr}`;
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsJournalPrintSelectedOnly(false);
      setIsArPrintSelectedOnly(false);
      setIsApPrintSelectedOnly(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Reset all filters
  const handleResetFilters = () => {
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    if (filterProjectId !== 'all') setFilterProjectId('all');
    setProfitMarginFilter('all');
    setProfitSearch('');
    setProfitSort('profit_desc');
    setBalanceSheetAsOf('current');
    setHideZeroBalanceAccounts(false);
    setTrialAccountClass('all');
    setTrialSearch('');
    setHideZeroTrial(false);
    setArAgingBracket('all');
    setArCustomerId('all');
    setArMinAmount(0);
    setArSearch('');
    setApAgingBracket('all');
    setApVendorId('all');
    setApCategory('all');
    setApMinAmount(0);
    setApSearch('');
    setJournalSourceType('all');
    setJournalStatus('all');
    setJournalEntityTrace('all');
    setJournalSearch('');
    setSelectedJournalIds(new Set());
    setSelectedArIds(new Set());
    setSelectedApIds(new Set());
  };

  const isAnyFilterActive =
    datePreset !== 'all' ||
    filterProjectId !== 'all' ||
    profitMarginFilter !== 'all' ||
    profitSearch !== '' ||
    trialAccountClass !== 'all' ||
    trialSearch !== '' ||
    hideZeroTrial ||
    hideZeroBalanceAccounts ||
    arAgingBracket !== 'all' ||
    arCustomerId !== 'all' ||
    arMinAmount > 0 ||
    arSearch !== '' ||
    apAgingBracket !== 'all' ||
    apVendorId !== 'all' ||
    apCategory !== 'all' ||
    apMinAmount > 0 ||
    apSearch !== '' ||
    journalSourceType !== 'all' ||
    journalStatus !== 'all' ||
    journalEntityTrace !== 'all' ||
    journalSearch !== '';

  const state = accountingService.getState();
  const summary = accountingService.getDashboardSummary();
  const rawProfitabilities = accountingService.getAllProjectProfitabilities();

  // Selected project object if filtered
  const selectedProjectObj = filterProjectId !== 'all'
    ? state.projects.find((p) => p.id === filterProjectId)
    : null;

  // -------------------------------------------------------------
  // FILTERED DATASETS
  // -------------------------------------------------------------

  // 1. Filtered Profitability
  const filteredProfitabilities = useMemo(() => {
    let list = [...rawProfitabilities];

    // Project filter
    if (filterProjectId !== 'all') {
      list = list.filter((p) => p.projectId === filterProjectId);
    }

    // Margin quick pills
    if (profitMarginFilter === 'high') {
      list = list.filter((p) => p.profitMargin >= 15);
    } else if (profitMarginFilter === 'mid') {
      list = list.filter((p) => p.profitMargin >= 5 && p.profitMargin < 15);
    } else if (profitMarginFilter === 'low') {
      list = list.filter((p) => p.profitMargin >= 0 && p.profitMargin < 5);
    } else if (profitMarginFilter === 'loss') {
      list = list.filter((p) => p.profitMargin < 0);
    }

    // Search query
    if (profitSearch.trim()) {
      const q = profitSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.projectCode.toLowerCase().includes(q) ||
          p.projectName.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (profitSort === 'profit_desc') return b.grossProfit - a.grossProfit;
      if (profitSort === 'margin_desc') return b.profitMargin - a.profitMargin;
      if (profitSort === 'contract_desc') return b.contractValue - a.contractValue;
      if (profitSort === 'cost_desc') return b.totalProjectCost - a.totalProjectCost;
      if (profitSort === 'code_asc') return a.projectCode.localeCompare(b.projectCode);
      return 0;
    });

    return list;
  }, [rawProfitabilities, filterProjectId, profitMarginFilter, profitSearch, profitSort]);

  // Profitability KPI totals
  const profitKpis = useMemo(() => {
    const totalContract = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.contractValue), 0);
    const totalInvoiced = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.totalInvoiced), 0);
    const totalCost = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.totalProjectCost), 0);
    const totalProfit = filteredProfitabilities.reduce((sum, p) => addMoney(sum, p.grossProfit), 0);
    const avgMargin = totalInvoiced > 0 ? (totalProfit / totalInvoiced) * 100 : 0;
    return { totalContract, totalInvoiced, totalCost, totalProfit, avgMargin };
  }, [filteredProfitabilities]);

  // 2. Dynamic Income Statement (Calculated for filtered period & project)
  const incomeStatementData = useMemo(() => {
    // Invoices matching date range and project
    const relevantInvoices = state.clientInvoices.filter((inv) => {
      if (inv.status === 'reversed') return false;
      if (filterProjectId !== 'all' && inv.projectId !== filterProjectId) return false;
      if (!isDateInRange(inv.date, dateRange.startDate, dateRange.endDate)) return false;
      return true;
    });
    const revenueInvoiced = relevantInvoices.reduce((sum, i) => addMoney(sum, i.amount), 0);

    // Purchases matching date range and project
    const relevantPurchases = state.purchases.filter((p) => {
      if (p.status === 'reversed') return false;
      if (filterProjectId !== 'all' && p.projectId !== filterProjectId) return false;
      if (!isDateInRange(p.date, dateRange.startDate, dateRange.endDate)) return false;
      return true;
    });
    const purchasesCost = relevantPurchases.reduce((sum, p) => addMoney(sum, p.amount), 0);

    // Direct Expenses matching date range and project
    const relevantExpenses = state.directExpenses.filter((e) => {
      if (e.status === 'reversed') return false;
      if (filterProjectId !== 'all' && e.projectId !== filterProjectId) return false;
      if (!isDateInRange(e.expenseDate, dateRange.startDate, dateRange.endDate)) return false;
      return true;
    });
    const expensesCost = relevantExpenses.reduce((sum, e) => addMoney(sum, e.amount), 0);

    const totalProjectCosts = addMoney(purchasesCost, expensesCost);
    const netProfit = revenueInvoiced - totalProjectCosts;
    const profitMargin = revenueInvoiced > 0 ? (netProfit / revenueInvoiced) * 100 : 0;

    return {
      revenueInvoiced,
      purchasesCost,
      expensesCost,
      totalProjectCosts,
      netProfit,
      profitMargin,
      invoiceCount: relevantInvoices.length,
      purchaseCount: relevantPurchases.length,
      expenseCount: relevantExpenses.length,
    };
  }, [state, filterProjectId, dateRange]);

  // 3. Dynamic Cash Flow Statement
  const cashFlowData = useMemo(() => {
    // Client Receipts (Money In)
    const clientReceipts = state.moneyInList.filter((m) => {
      if (m.status === 'reversed') return false;
      if (filterProjectId !== 'all' && m.projectId !== filterProjectId) return false;
      if (!isDateInRange(m.transactionDate, dateRange.startDate, dateRange.endDate)) return false;
      return true;
    });
    const totalReceipts = clientReceipts.reduce((sum, m) => addMoney(sum, m.amount), 0);

    // Vendor Payments (Money Out)
    const vendorPayments = state.moneyOutList.filter((m) => {
      if (m.status === 'reversed') return false;
      if (filterProjectId !== 'all' && m.projectId !== filterProjectId) return false;
      if (!isDateInRange(m.transactionDate, dateRange.startDate, dateRange.endDate)) return false;
      return true;
    });
    const totalVendorPaid = vendorPayments.reduce((sum, m) => addMoney(sum, m.amount), 0);

    // Direct Site Expenses Paid
    const siteExpensesPaid = state.directExpenses.filter((e) => {
      if (e.status === 'reversed') return false;
      if (filterProjectId !== 'all' && e.projectId !== filterProjectId) return false;
      if (!isDateInRange(e.expenseDate, dateRange.startDate, dateRange.endDate)) return false;
      return true;
    });
    const totalExpensesPaid = siteExpensesPaid.reduce((sum, e) => addMoney(sum, e.amount), 0);

    const totalOutflows = addMoney(totalVendorPaid, totalExpensesPaid);
    const netCashFlow = totalReceipts - totalOutflows;

    return {
      totalReceipts,
      totalVendorPaid,
      totalExpensesPaid,
      totalOutflows,
      netCashFlow,
      receiptCount: clientReceipts.length,
      paymentCount: vendorPayments.length,
      expenseCount: siteExpensesPaid.length,
    };
  }, [state, filterProjectId, dateRange]);

  // 4. Filtered AR Aging (Receivables)
  const filteredArAging = useMemo(() => {
    return state.clientInvoices
      .filter((inv) => inv.outstandingAmount > 0 && inv.status !== 'reversed')
      .map((inv) => {
        const days = calculateAgingDays(inv.date);
        const bracketInfo = getAgingBadge(days);
        return {
          ...inv,
          days,
          bracket: bracketInfo.bracket,
          badgeClass: bracketInfo.badgeClass,
          bracketLabel: bracketInfo.label,
        };
      })
      .filter((inv) => {
        if (filterProjectId !== 'all' && inv.projectId !== filterProjectId) return false;
        if (arCustomerId !== 'all' && inv.customerId !== arCustomerId) return false;
        if (arAgingBracket !== 'all' && inv.bracket !== arAgingBracket) return false;
        if (arMinAmount > 0 && inv.outstandingAmount < arMinAmount) return false;
        if (arSearch.trim()) {
          const q = arSearch.toLowerCase();
          const matchInv = inv.invoiceNumber.toLowerCase().includes(q);
          const matchCust = inv.customerName.toLowerCase().includes(q);
          const matchPrj = inv.projectName.toLowerCase().includes(q);
          if (!matchInv && !matchCust && !matchPrj) return false;
        }
        return true;
      });
  }, [state.clientInvoices, filterProjectId, arCustomerId, arAgingBracket, arMinAmount, arSearch]);

  const arTotals = useMemo(() => {
    const totalOutstanding = filteredArAging.reduce((sum, i) => addMoney(sum, i.outstandingAmount), 0);
    const totalOriginal = filteredArAging.reduce((sum, i) => addMoney(sum, i.amount), 0);
    const overdueCount = filteredArAging.filter((i) => i.bracket !== '0_30').length;
    return { totalOutstanding, totalOriginal, overdueCount, count: filteredArAging.length };
  }, [filteredArAging]);

  // 5. Filtered AP Aging (Payables)
  const filteredApAging = useMemo(() => {
    return state.purchases
      .filter((p) => p.outstandingAmount > 0 && p.status !== 'reversed')
      .map((p) => {
        const days = calculateAgingDays(p.date);
        const bracketInfo = getAgingBadge(days);
        return {
          ...p,
          days,
          bracket: bracketInfo.bracket,
          badgeClass: bracketInfo.badgeClass,
          bracketLabel: bracketInfo.label,
        };
      })
      .filter((p) => {
        if (filterProjectId !== 'all' && p.projectId !== filterProjectId) return false;
        if (apVendorId !== 'all' && p.vendorId !== apVendorId) return false;
        if (apCategory !== 'all' && p.purchaseCategory !== apCategory) return false;
        if (apAgingBracket !== 'all' && p.bracket !== apAgingBracket) return false;
        if (apMinAmount > 0 && p.outstandingAmount < apMinAmount) return false;
        if (apSearch.trim()) {
          const q = apSearch.toLowerCase();
          const matchBill = p.purchaseInvoiceNumber.toLowerCase().includes(q);
          const matchVend = p.vendorName.toLowerCase().includes(q);
          const matchPrj = p.projectName.toLowerCase().includes(q);
          if (!matchBill && !matchVend && !matchPrj) return false;
        }
        return true;
      });
  }, [state.purchases, filterProjectId, apVendorId, apCategory, apAgingBracket, apMinAmount, apSearch]);

  const apTotals = useMemo(() => {
    const totalOutstanding = filteredApAging.reduce((sum, p) => addMoney(sum, p.outstandingAmount), 0);
    const totalOriginal = filteredApAging.reduce((sum, p) => addMoney(sum, p.amount), 0);
    const overdueCount = filteredApAging.filter((p) => p.bracket !== '0_30').length;
    return { totalOutstanding, totalOriginal, overdueCount, count: filteredApAging.length };
  }, [filteredApAging]);

  // 6. Filtered General Journal
  const filteredJournalEntries = useMemo(() => {
    const allEntries = accountingService.getJournalEntries();
    return allEntries.filter((je) => {
      // Date filter
      if (!isDateInRange(je.date, dateRange.startDate, dateRange.endDate)) return false;

      // Project filter
      if (filterProjectId !== 'all' && je.projectId !== filterProjectId) return false;

      // Source type
      if (journalSourceType !== 'all' && je.sourceType !== journalSourceType) return false;

      // Status
      if (journalStatus !== 'all' && je.status !== journalStatus) return false;

      // Entity trace
      if (journalEntityTrace === 'project' && !je.projectId) return false;
      if (journalEntityTrace === 'customer' && !je.customerId) return false;
      if (journalEntityTrace === 'vendor' && !je.vendorId) return false;
      if (journalEntityTrace === 'internal' && (je.projectId || je.customerId || je.vendorId)) return false;

      // Search
      if (journalSearch.trim()) {
        const q = journalSearch.toLowerCase();
        const prj = state.projects.find((p) => p.id === je.projectId);
        const cust = state.customers.find((c) => c.id === je.customerId);
        const vend = state.vendors.find((v) => v.id === je.vendorId);
        const matchEntry = je.entryNumber.toLowerCase().includes(q);
        const matchDebit = je.debitAccount.toLowerCase().includes(q);
        const matchCredit = je.creditAccount.toLowerCase().includes(q);
        const matchDesc = je.description.toLowerCase().includes(q);
        const matchPrj = prj && prj.name.toLowerCase().includes(q);
        const matchCust = cust && cust.name.toLowerCase().includes(q);
        const matchVend = vend && vend.name.toLowerCase().includes(q);
        if (!matchEntry && !matchDebit && !matchCredit && !matchDesc && !matchPrj && !matchCust && !matchVend) {
          return false;
        }
      }

      return true;
    });
  }, [state, dateRange, filterProjectId, journalSourceType, journalStatus, journalEntityTrace, journalSearch]);

  const journalTotals = useMemo(() => {
    const totalVolume = filteredJournalEntries.reduce((sum, je) => addMoney(sum, je.amount), 0);
    return { count: filteredJournalEntries.length, totalVolume };
  }, [filteredJournalEntries]);

  // 7. Filtered Trial Balance Rows
  const trialBalanceRows = useMemo(() => {
    const rawRows = [
      { code: '1010', name: 'Bank Accounts (Muscat & Dhofar)', debit: summary.totalBankBalance, credit: 0, class: 'assets' },
      { code: '1020', name: 'Cash in Hand (Head Office Cashier)', debit: summary.totalCashBalance, credit: 0, class: 'assets' },
      { code: '1030', name: 'Petty Cash Floats (Site Custodians)', debit: summary.totalPettyCashBalance, credit: 0, class: 'assets' },
      { code: '1200', name: 'Accounts Receivable (Contract Clients)', debit: summary.totalReceivables, credit: 0, class: 'assets' },
      { code: '2010', name: 'Accounts Payable (Trade Vendors & Subs)', debit: 0, credit: summary.totalPayables, class: 'liabilities' },
      { code: '4010', name: 'Construction Revenue (Invoiced & IPCs)', debit: 0, credit: summary.totalRevenueInvoiced, class: 'revenue' },
      { code: '5010', name: 'Direct Material & Subcontractor Costs', debit: summary.totalPurchases, credit: 0, class: 'expenses' },
      { code: '5020', name: 'Direct Site & Project Running Expenses', debit: summary.totalDirectExpenses, credit: 0, class: 'expenses' },
    ];

    return rawRows.filter((r) => {
      if (trialAccountClass !== 'all' && r.class !== trialAccountClass) return false;
      if (hideZeroTrial && r.debit === 0 && r.credit === 0) return false;
      if (trialSearch.trim()) {
        const q = trialSearch.toLowerCase();
        if (!r.code.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [summary, trialAccountClass, hideZeroTrial, trialSearch]);

  // -------------------------------------------------------------
  // FINANCIAL DATA EXPORT GENERATORS
  // (Utilizes real-time accountingService state and active filters)
  // -------------------------------------------------------------
  const getProfitabilityExportData = () => {
    return filteredProfitabilities.map((p) => ({
      'Project Code': p.projectCode,
      'Project Name': p.projectName,
      'Client': p.customerName,
      'Contract Value (OMR)': p.contractValue,
      'Invoiced Revenue (OMR)': p.totalInvoiced,
      'Cash Collected (OMR)': p.totalReceived,
      'Receivable Balance (OMR)': p.outstandingReceivable,
      'Purchases Cost (OMR)': p.totalPurchases,
      'Direct Expenses (OMR)': p.totalExpenses,
      'Total Project Cost (OMR)': p.totalProjectCost,
      'Gross Profit (OMR)': p.grossProfit,
      'Margin (%)': `${p.profitMargin.toFixed(2)}%`,
    }));
  };

  const getIncomeStatementExportData = () => {
    const is = incomeStatementData;
    return [
      { 'Category': 'REVENUE', 'Line Item': 'Construction Billing (Invoices & IPCs)', 'Amount (OMR)': is.revenueInvoiced, '% Revenue': '100.0%' },
      { 'Category': 'REVENUE', 'Line Item': 'Total Operating Revenue', 'Amount (OMR)': is.revenueInvoiced, '% Revenue': '100.0%' },
      { 'Category': 'COST OF CONSTRUCTION', 'Line Item': 'Materials & Subcontractor Purchases', 'Amount (OMR)': is.purchasesCost, '% Revenue': is.revenueInvoiced > 0 ? `${((is.purchasesCost / is.revenueInvoiced) * 100).toFixed(1)}%` : '—' },
      { 'Category': 'COST OF CONSTRUCTION', 'Line Item': 'Direct Project & Site Expenses', 'Amount (OMR)': is.expensesCost, '% Revenue': is.revenueInvoiced > 0 ? `${((is.expensesCost / is.revenueInvoiced) * 100).toFixed(1)}%` : '—' },
      { 'Category': 'COST OF CONSTRUCTION', 'Line Item': 'Total Direct Project Costs', 'Amount (OMR)': is.totalProjectCosts, '% Revenue': is.revenueInvoiced > 0 ? `${((is.totalProjectCosts / is.revenueInvoiced) * 100).toFixed(1)}%` : '—' },
      { 'Category': 'NET PROFIT', 'Line Item': 'Net Construction Gross Profit', 'Amount (OMR)': is.netProfit, '% Revenue': is.revenueInvoiced > 0 ? `${((is.netProfit / is.revenueInvoiced) * 100).toFixed(1)}%` : '—' },
      { 'Category': 'PROFIT MARGIN', 'Line Item': 'Gross Profit Margin (%)', 'Amount (OMR)': `${is.profitMargin.toFixed(2)}%`, '% Revenue': '' },
    ];
  };

  const getBalanceSheetExportData = () => {
    const totalAssets = summary.totalLiquidFunds + summary.totalReceivables;
    const totalLiabilities = summary.totalPayables;
    const equity = totalAssets - totalLiabilities;

    return [
      { 'Section': 'ASSETS - Current Assets', 'Account': 'Bank Accounts', 'Amount (OMR)': summary.totalBankBalance },
      { 'Section': 'ASSETS - Current Assets', 'Account': 'Cash in Hand', 'Amount (OMR)': summary.totalCashBalance },
      { 'Section': 'ASSETS - Current Assets', 'Account': 'Petty Cash Floats', 'Amount (OMR)': summary.totalPettyCashBalance },
      { 'Section': 'ASSETS - Current Assets', 'Account': 'Accounts Receivable (Clients)', 'Amount (OMR)': summary.totalReceivables },
      { 'Section': 'ASSETS TOTAL', 'Account': 'TOTAL ASSETS', 'Amount (OMR)': totalAssets },
      { 'Section': 'LIABILITIES', 'Account': 'Accounts Payable (Vendors & Subcontractors)', 'Amount (OMR)': summary.totalPayables },
      { 'Section': 'LIABILITIES TOTAL', 'Account': 'TOTAL LIABILITIES', 'Amount (OMR)': totalLiabilities },
      { 'Section': 'EQUITY', 'Account': 'Retained Earnings & Current Period Earnings', 'Amount (OMR)': equity },
      { 'Section': 'EQUITY TOTAL', 'Account': 'TOTAL LIABILITIES & EQUITY', 'Amount (OMR)': totalLiabilities + equity },
    ];
  };

  const getTrialBalanceExportData = () => {
    return trialBalanceRows.map((r) => ({
      'Account Code': r.code,
      'Account Name': r.name,
      'Class': r.class.toUpperCase(),
      'Debit (OMR)': r.debit > 0 ? r.debit : '',
      'Credit (OMR)': r.credit > 0 ? r.credit : '',
    }));
  };

  const getCashFlowExportData = () => {
    const cf = cashFlowData;
    return [
      { 'Section': 'OPERATING INFLOWS', 'Description': 'Receipts from Clients / IPC Collections', 'Inflow (OMR)': cf.totalReceipts, 'Outflow (OMR)': '' },
      { 'Section': 'OPERATING OUTFLOWS', 'Description': 'Settlements to Vendors & Subcontractors', 'Inflow (OMR)': '', 'Outflow (OMR)': cf.totalVendorPaid },
      { 'Section': 'OPERATING OUTFLOWS', 'Description': 'Payments for Direct Site Expenses', 'Inflow (OMR)': '', 'Outflow (OMR)': cf.totalExpensesPaid },
      { 'Section': 'TOTAL OUTFLOWS', 'Description': 'Total Operating Disbursements', 'Inflow (OMR)': '', 'Outflow (OMR)': cf.totalOutflows },
      { 'Section': 'NET CASH FLOW', 'Description': 'Net Cash Flow for the Period', 'Inflow (OMR)': cf.netCashFlow > 0 ? cf.netCashFlow : '', 'Outflow (OMR)': cf.netCashFlow < 0 ? Math.abs(cf.netCashFlow) : '' },
    ];
  };

  const getArAgingExportData = () => {
    return filteredArAging.map((inv) => ({
      'Invoice / IPC #': inv.invoiceNumber,
      'Date': inv.date,
      'Customer': inv.customerName,
      'Project': inv.projectName,
      'Total Amount (OMR)': inv.amount,
      'Received (OMR)': inv.receivedAmount,
      'Outstanding Balance (OMR)': inv.outstandingAmount,
      'Days Outstanding': inv.days,
      'Aging Bracket': inv.bracketLabel,
    }));
  };

  const getApAgingExportData = () => {
    return filteredApAging.map((p) => ({
      'Purchase Bill #': p.purchaseInvoiceNumber,
      'Date': p.date,
      'Vendor': p.vendorName,
      'Project': p.projectName,
      'Category': p.purchaseCategory,
      'Total Amount (OMR)': p.amount,
      'Paid (OMR)': p.paidAmount,
      'Outstanding Balance (OMR)': p.outstandingAmount,
      'Days Outstanding': p.days,
      'Aging Bracket': p.bracketLabel,
    }));
  };

  const getGeneralJournalExportData = () => {
    return filteredJournalEntries.map((je) => {
      const prj = state.projects.find((p) => p.id === je.projectId);
      const cust = state.customers.find((c) => c.id === je.customerId);
      const vend = state.vendors.find((v) => v.id === je.vendorId);
      return {
        'Entry #': je.entryNumber,
        'Date': je.date,
        'Source Type': je.sourceType.toUpperCase(),
        'Project Trace': prj ? `${prj.code} - ${prj.name}` : '-',
        'Customer Trace': cust ? `${cust.code} - ${cust.name}` : '-',
        'Vendor Trace': vend ? `${vend.code} - ${vend.name}` : '-',
        'Debit Account': je.debitAccount,
        'Credit Account': je.creditAccount,
        'Amount (OMR)': je.amount,
        'Status': je.status.toUpperCase(),
        'Description': je.description,
      };
    });
  };

  // -------------------------------------------------------------
  // EXCEL & CSV EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleExport = (exportFormat: 'excel' | 'csv' = 'excel', reportOverride?: ReportType) => {
    const targetReport = reportOverride || selectedReport;
    const exportFn = exportFormat === 'csv' ? exportToCsv : exportToExcel;
    const today = new Date().toISOString().split('T')[0];
    const projectSuffix = selectedProjectObj ? `_${selectedProjectObj.code}` : '_AllProjects';
    const periodSuffix = dateRange.label.replace(/\s+/g, '_');

    if (targetReport === 'profitability') {
      exportFn({
        filename: `Project_Profitability_${periodSuffix}${projectSuffix}_${today}`,
        sheetName: 'Profitability',
        title: `CONSTRUCTION PROJECT PROFITABILITY REPORT (${dateRange.label.toUpperCase()})`,
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getProfitabilityExportData(),
      });
    } else if (targetReport === 'income_statement') {
      exportFn({
        filename: `Income_Statement_${periodSuffix}${projectSuffix}_${today}`,
        sheetName: 'Income Statement',
        title: `STATEMENT OF PROFIT & LOSS (${dateRange.label.toUpperCase()}${selectedProjectObj ? ` — ${selectedProjectObj.name}` : ''})`,
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getIncomeStatementExportData(),
      });
    } else if (targetReport === 'balance_sheet') {
      exportFn({
        filename: `Balance_Sheet_${today}`,
        sheetName: 'Balance Sheet',
        title: 'STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)',
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getBalanceSheetExportData(),
      });
    } else if (targetReport === 'trial_balance') {
      exportFn({
        filename: `Trial_Balance_${today}`,
        sheetName: 'Trial Balance',
        title: 'TRIAL BALANCE STATEMENT (FILTERED)',
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getTrialBalanceExportData(),
      });
    } else if (targetReport === 'cash_flow') {
      exportFn({
        filename: `Cash_Flow_${periodSuffix}${projectSuffix}_${today}`,
        sheetName: 'Cash Flow',
        title: `STATEMENT OF CASH FLOWS (${dateRange.label.toUpperCase()})`,
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getCashFlowExportData(),
      });
    } else if (targetReport === 'ar_aging') {
      exportFn({
        filename: `AR_Aging_Report_${arAgingBracket}_${today}`,
        sheetName: 'AR Aging',
        title: `ACCOUNTS RECEIVABLE AGING ANALYSIS (${arAgingBracket.toUpperCase()})`,
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getArAgingExportData(),
      });
    } else if (targetReport === 'ap_aging') {
      exportFn({
        filename: `AP_Aging_Report_${apAgingBracket}_${today}`,
        sheetName: 'AP Aging',
        title: `ACCOUNTS PAYABLE AGING ANALYSIS (${apAgingBracket.toUpperCase()})`,
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getApAgingExportData(),
      });
    } else if (targetReport === 'general_journal') {
      exportFn({
        filename: `General_Journal_${periodSuffix}_${today}`,
        sheetName: 'General Journal',
        title: `GENERAL JOURNAL & AUDIT TRACE (${dateRange.label.toUpperCase()})`,
        companyName: 'Construction Accounting ERP - Sultanate of Oman',
        currency: 'OMR',
        data: getGeneralJournalExportData(),
      });
    }

    toast.success(
      `Table Exported (${exportFormat.toUpperCase()})`,
      `Downloaded ${targetReport.replace(/_/g, ' ')} as ${exportFormat === 'csv' ? 'Excel-compatible CSV' : 'Excel workbook'}.`
    );
  };

  /**
   * Export all 8 financial report statements into a single multi-sheet Excel workbook (.xlsx)
   */
  const handleExportAll = () => {
    const today = new Date().toISOString().split('T')[0];
    const projectSuffix = selectedProjectObj ? `_${selectedProjectObj.code}` : '';

    exportMultiSheetExcel({
      filename: `Artify_Financial_Package${projectSuffix}_${today}`,
      sheets: [
        { sheetName: '1. Profitability', data: getProfitabilityExportData() },
        { sheetName: '2. Income Statement', data: getIncomeStatementExportData() },
        { sheetName: '3. Balance Sheet', data: getBalanceSheetExportData() },
        { sheetName: '4. Trial Balance', data: getTrialBalanceExportData() },
        { sheetName: '5. Cash Flow', data: getCashFlowExportData() },
        { sheetName: '6. AR Aging', data: getArAgingExportData() },
        { sheetName: '7. AP Aging', data: getApAgingExportData() },
        { sheetName: '8. General Journal', data: getGeneralJournalExportData() },
      ],
    });

    toast.success(
      'Full Financial Package Exported (XLSX)',
      'Downloaded all 8 financial statements in a consolidated multi-sheet Excel workbook.'
    );
  };

  // -------------------------------------------------------------
  // SELECTION HELPERS & ACTIONS FOR MULTI-RECORD PDF PRINTING
  // -------------------------------------------------------------
  const selectedJournalSum = useMemo(() => {
    return filteredJournalEntries
      .filter((je) => selectedJournalIds.has(je.id))
      .reduce((sum, je) => addMoney(sum, je.amount), 0);
  }, [filteredJournalEntries, selectedJournalIds]);

  const currentSelectionCount = useMemo(() => {
    if (selectedReport === 'general_journal') return selectedJournalIds.size;
    if (selectedReport === 'ar_aging') return selectedArIds.size;
    if (selectedReport === 'ap_aging') return selectedApIds.size;
    return 0;
  }, [selectedReport, selectedJournalIds.size, selectedArIds.size, selectedApIds.size]);

  // Journal selection helpers
  const handleToggleJournalSelect = (id: string) => {
    setSelectedJournalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllJournalSelected =
    filteredJournalEntries.length > 0 &&
    filteredJournalEntries.every((je) => selectedJournalIds.has(je.id));

  const handleSelectAllJournal = () => {
    if (isAllJournalSelected) {
      setSelectedJournalIds(new Set());
    } else {
      setSelectedJournalIds(new Set(filteredJournalEntries.map((je) => je.id)));
    }
  };

  // AR selection helpers
  const handleToggleArSelect = (id: string) => {
    setSelectedArIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllArSelected =
    filteredArAging.length > 0 && filteredArAging.every((inv) => selectedArIds.has(inv.id));

  const handleSelectAllAr = () => {
    if (isAllArSelected) {
      setSelectedArIds(new Set());
    } else {
      setSelectedArIds(new Set(filteredArAging.map((inv) => inv.id)));
    }
  };

  // AP selection helpers
  const handleToggleApSelect = (id: string) => {
    setSelectedApIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllApSelected =
    filteredApAging.length > 0 && filteredApAging.every((p) => selectedApIds.has(p.id));

  const handleSelectAllAp = () => {
    if (isAllApSelected) {
      setSelectedApIds(new Set());
    } else {
      setSelectedApIds(new Set(filteredApAging.map((p) => p.id)));
    }
  };

  const handlePrint = (selectedOnly: boolean = false) => {
    setPrintTimestamp(getFormattedTimestamp());
    if (selectedReport === 'general_journal' && selectedOnly && selectedJournalIds.size > 0) {
      setIsJournalPrintSelectedOnly(true);
    } else if (selectedReport === 'ar_aging' && selectedOnly && selectedArIds.size > 0) {
      setIsArPrintSelectedOnly(true);
    } else if (selectedReport === 'ap_aging' && selectedOnly && selectedApIds.size > 0) {
      setIsApPrintSelectedOnly(true);
    } else {
      setIsJournalPrintSelectedOnly(false);
      setIsArPrintSelectedOnly(false);
      setIsApPrintSelectedOnly(false);
    }
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const handleOpenPrintPreview = (selectedOnly: boolean = false) => {
    setPrintTimestamp(getFormattedTimestamp());
    setPreviewSelectedOnly(selectedOnly);
    setIsPrintPreviewOpen(true);
  };

  const handleConfirmPrintFromModal = () => {
    setIsPrintPreviewOpen(false);
    handlePrint(previewSelectedOnly);
  };

  // -------------------------------------------------------------
  // PRINT PREVIEW CONFIGURATION BY REPORT TYPE
  // -------------------------------------------------------------
  const journalEntriesForPreview = useMemo(() => {
    return previewSelectedOnly && selectedJournalIds.size > 0
      ? filteredJournalEntries.filter((je) => selectedJournalIds.has(je.id))
      : filteredJournalEntries;
  }, [previewSelectedOnly, selectedJournalIds, filteredJournalEntries]);

  const arAgingForPreview = useMemo(() => {
    return previewSelectedOnly && selectedArIds.size > 0
      ? filteredArAging.filter((inv) => selectedArIds.has(inv.id))
      : filteredArAging;
  }, [previewSelectedOnly, selectedArIds, filteredArAging]);

  const apAgingForPreview = useMemo(() => {
    return previewSelectedOnly && selectedApIds.size > 0
      ? filteredApAging.filter((p) => selectedApIds.has(p.id))
      : filteredApAging;
  }, [previewSelectedOnly, selectedApIds, filteredApAging]);

  const journalPreviewColumns: PrintPreviewColumn<any>[] = [
    { header: 'Entry #', accessor: (je) => je.entryNumber, isMono: true, width: 'w-24' },
    { header: 'Date', accessor: (je) => je.date, isMono: true, width: 'w-24' },
    { header: 'Source Type', accessor: (je) => je.sourceType, width: 'w-28' },
    { header: 'Debit Account', accessor: (je) => je.debitAccount },
    { header: 'Credit Account', accessor: (je) => je.creditAccount },
    {
      header: 'Amount (OMR)',
      accessor: (je) => <span className="font-bold text-slate-900">{formatOMR(je.amount)}</span>,
      align: 'right',
      isMono: true,
      width: 'w-28',
    },
    {
      header: 'Status',
      accessor: (je) => (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
            je.status === 'POSTED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {je.status.toUpperCase()}
        </span>
      ),
      align: 'center',
      width: 'w-20',
    },
  ];

  const arPreviewColumns: PrintPreviewColumn<any>[] = [
    { header: 'Invoice #', accessor: (inv) => inv.invoiceNumber, isMono: true, width: 'w-24' },
    { header: 'Date', accessor: (inv) => inv.date, isMono: true, width: 'w-24' },
    {
      header: 'Customer',
      accessor: (inv) => <span className="font-semibold text-slate-800">{inv.customerName}</span>,
    },
    { header: 'Project', accessor: (inv) => inv.projectName },
    {
      header: 'Invoiced (OMR)',
      accessor: (inv) => formatOMR(inv.amount),
      align: 'right',
      isMono: true,
    },
    {
      header: 'Received (OMR)',
      accessor: (inv) => <span className="text-emerald-700">{formatOMR(inv.receivedAmount)}</span>,
      align: 'right',
      isMono: true,
    },
    {
      header: 'Outstanding (OMR)',
      accessor: (inv) => (
        <span className="font-bold text-blue-700">{formatOMR(inv.outstandingAmount)}</span>
      ),
      align: 'right',
      isMono: true,
    },
    {
      header: 'Aging Bracket',
      accessor: (inv) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${inv.badgeClass}`}>
          {inv.bracketLabel}
        </span>
      ),
      align: 'center',
      width: 'w-28',
    },
  ];

  const apPreviewColumns: PrintPreviewColumn<any>[] = [
    { header: 'Bill #', accessor: (p) => p.purchaseInvoiceNumber, isMono: true, width: 'w-24' },
    { header: 'Date', accessor: (p) => p.date, isMono: true, width: 'w-24' },
    {
      header: 'Vendor',
      accessor: (p) => <span className="font-semibold text-slate-800">{p.vendorName}</span>,
    },
    { header: 'Project', accessor: (p) => p.projectName },
    {
      header: 'Category',
      accessor: (p) => (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
          {p.purchaseCategory || 'General'}
        </span>
      ),
    },
    {
      header: 'Bill Amount (OMR)',
      accessor: (p) => formatOMR(p.amount),
      align: 'right',
      isMono: true,
    },
    {
      header: 'Settled (OMR)',
      accessor: (p) => <span className="text-emerald-700">{formatOMR(p.paidAmount)}</span>,
      align: 'right',
      isMono: true,
    },
    {
      header: 'Outstanding (OMR)',
      accessor: (p) => (
        <span className="font-bold text-amber-700">{formatOMR(p.outstandingAmount)}</span>
      ),
      align: 'right',
      isMono: true,
    },
    {
      header: 'Aging Bracket',
      accessor: (p) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${p.badgeClass}`}>
          {p.bracketLabel}
        </span>
      ),
      align: 'center',
      width: 'w-28',
    },
  ];

  const profitabilityPreviewColumns: PrintPreviewColumn<any>[] = [
    {
      header: 'Project Code & Name',
      accessor: (p) => `${p.projectCode} - ${p.projectName}`,
      width: 'w-44',
    },
    { header: 'Customer', accessor: (p) => p.customerName },
    {
      header: 'Contract (OMR)',
      accessor: (p) => formatOMR(p.contractValue),
      align: 'right',
      isMono: true,
    },
    {
      header: 'Invoiced (OMR)',
      accessor: (p) => formatOMR(p.totalInvoiced),
      align: 'right',
      isMono: true,
    },
    {
      header: 'Cost (OMR)',
      accessor: (p) => formatOMR(p.totalProjectCost),
      align: 'right',
      isMono: true,
    },
    {
      header: 'Gross Profit (OMR)',
      accessor: (p) => <span className="font-bold">{formatOMR(p.grossProfit)}</span>,
      align: 'right',
      isMono: true,
    },
    {
      header: 'Margin',
      accessor: (p) => formatPercent(p.profitMarginPercent),
      align: 'right',
      isMono: true,
    },
  ];

  const journalPreviewSummary = (
    <tr className="bg-slate-100 font-bold border-t-2 border-t-slate-800 border-b-4 border-b-double border-b-slate-900">
      <td colSpan={5} className="py-2.5 px-3 uppercase tracking-wider text-slate-900 text-right">
        Total Amount ({journalEntriesForPreview.length} records):
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-extrabold">
        {formatOMR(journalEntriesForPreview.reduce((sum, je) => addMoney(sum, je.amount), 0))}
      </td>
      <td></td>
    </tr>
  );

  const arPreviewSummary = (() => {
    const totAmt = arAgingForPreview.reduce((s, r) => addMoney(s, r.amount), 0);
    const totRcv = arAgingForPreview.reduce((s, r) => addMoney(s, r.receivedAmount), 0);
    const totOut = arAgingForPreview.reduce((s, r) => addMoney(s, r.outstandingAmount), 0);
    return (
      <tr className="bg-slate-100 font-bold border-t-2 border-t-slate-800 border-b-4 border-b-double border-b-slate-900">
        <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wider text-slate-900 text-right">
          Totals ({arAgingForPreview.length} records):
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-bold">
          {formatOMR(totAmt)}
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
          {formatOMR(totRcv)}
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-blue-700 font-extrabold">
          {formatOMR(totOut)}
        </td>
        <td></td>
      </tr>
    );
  })();

  const apPreviewSummary = (() => {
    const totAmt = apAgingForPreview.reduce((s, r) => addMoney(s, r.amount), 0);
    const totPaid = apAgingForPreview.reduce((s, r) => addMoney(s, r.paidAmount), 0);
    const totOut = apAgingForPreview.reduce((s, r) => addMoney(s, r.outstandingAmount), 0);
    return (
      <tr className="bg-slate-100 font-bold border-t-2 border-t-slate-800 border-b-4 border-b-double border-b-slate-900">
        <td colSpan={5} className="py-2.5 px-3 uppercase tracking-wider text-slate-900 text-right">
          Totals ({apAgingForPreview.length} records):
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-bold">
          {formatOMR(totAmt)}
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
          {formatOMR(totPaid)}
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-extrabold">
          {formatOMR(totOut)}
        </td>
        <td></td>
      </tr>
    );
  })();

  const profitPreviewSummary = (
    <tr className="bg-slate-100 font-bold border-t-2 border-t-slate-800 border-b-4 border-b-double border-b-slate-900">
      <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider text-slate-900 text-right">
        Portfolio Totals:
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
        {formatOMR(profitKpis.totalContract)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
        {formatOMR(profitKpis.totalInvoiced)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
        {formatOMR(profitKpis.totalCost)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-extrabold">
        {formatOMR(profitKpis.totalProfit)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-bold">
        {formatPercent(profitKpis.avgMargin)}
      </td>
    </tr>
  );

  const getPreviewConfig = () => {
    if (selectedReport === 'general_journal') {
      return {
        title:
          previewSelectedOnly && selectedJournalIds.size > 0
            ? 'General Journal - Selected Transaction Records'
            : 'General Journal & Audit Ledger',
        docRef: `DOC-GJ-${new Date().getFullYear()}-${journalEntriesForPreview.length}`,
        scope:
          previewSelectedOnly && selectedJournalIds.size > 0
            ? `Selected Transactions (${selectedJournalIds.size} records, ${formatOMR(
                selectedJournalSum
              )})`
            : selectedProjectObj
            ? `${selectedProjectObj.name} (${selectedProjectObj.code})`
            : 'All Projects Consolidated',
        columns: journalPreviewColumns,
        data: journalEntriesForPreview,
        summaryRow: journalPreviewSummary,
        emptyMessage: 'No journal transaction entries selected for preview.',
      };
    }

    if (selectedReport === 'ar_aging') {
      return {
        title:
          previewSelectedOnly && selectedArIds.size > 0
            ? 'Accounts Receivable (AR) - Selected Invoices'
            : 'Accounts Receivable (AR) Aging Summary',
        docRef: `DOC-AR-${new Date().getFullYear()}-${arAgingForPreview.length}`,
        scope:
          previewSelectedOnly && selectedArIds.size > 0
            ? `Selected Invoices (${selectedArIds.size} items)`
            : selectedProjectObj
            ? `${selectedProjectObj.name} (${selectedProjectObj.code})`
            : 'All Projects Consolidated',
        columns: arPreviewColumns,
        data: arAgingForPreview,
        summaryRow: arPreviewSummary,
        emptyMessage: 'No receivable invoices selected for preview.',
      };
    }

    if (selectedReport === 'ap_aging') {
      return {
        title:
          previewSelectedOnly && selectedApIds.size > 0
            ? 'Accounts Payable (AP) - Selected Bills'
            : 'Accounts Payable (AP) Aging Summary',
        docRef: `DOC-AP-${new Date().getFullYear()}-${apAgingForPreview.length}`,
        scope:
          previewSelectedOnly && selectedApIds.size > 0
            ? `Selected Bills (${selectedApIds.size} items)`
            : selectedProjectObj
            ? `${selectedProjectObj.name} (${selectedProjectObj.code})`
            : 'All Projects Consolidated',
        columns: apPreviewColumns,
        data: apAgingForPreview,
        summaryRow: apPreviewSummary,
        emptyMessage: 'No payable bills selected for preview.',
      };
    }

    // Profitability & Cost Analysis
    return {
      title: 'Project Profitability & Cost Analysis',
      docRef: `DOC-PRF-${new Date().getFullYear()}-${filteredProfitabilities.length}`,
      scope: selectedProjectObj
        ? `${selectedProjectObj.name} (${selectedProjectObj.code})`
        : 'All Projects Consolidated',
      columns: profitabilityPreviewColumns,
      data: filteredProfitabilities,
      summaryRow: profitPreviewSummary,
      emptyMessage: 'No project profitability records to preview.',
    };
  };

  const previewConfig = getPreviewConfig();

  return (
    <div className="space-y-5">
      {/* Top Title & Export & Print Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Financial Reports &amp; Statements</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              NUMERIC(18, 3) OMR
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time IFRS/GAAP-compliant construction accounting reports with interactive quick filtering
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAnyFilterActive && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              title="Reset all quick filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}

          {currentSelectionCount > 0 ? (
            <>
              <button
                type="button"
                onClick={() => handleOpenPrintPreview(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 transition-colors cursor-pointer shadow-xs"
                title="Preview print layout before printing selected records"
              >
                <Eye className="w-4 h-4 text-blue-600" />
                Print Preview ({currentSelectionCount})
              </button>
              <button
                type="button"
                onClick={() => handlePrint(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
                title="Print selected records as a single combined PDF document"
              >
                <Printer className="w-4 h-4 text-blue-300" />
                Print Selected ({currentSelectionCount}) as PDF
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpenPrintPreview(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
                title="Preview print layout before printing"
              >
                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                Print Preview
              </button>
              <button
                type="button"
                onClick={() => handlePrint(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
                title="Print report (PDF / Printer)"
              >
                <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                Print Report
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer shadow-xs"
            title="Download active financial table in Excel-compatible CSV format"
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Export to CSV
          </button>

          <button
            type="button"
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-emerald-700 hover:bg-emerald-600 transition-colors cursor-pointer shadow"
            title="Download active financial table as Excel workbook (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Table (Excel)
          </button>

          <button
            type="button"
            onClick={handleExportAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow"
            title="Export all 8 financial statements into a single consolidated multi-sheet Excel workbook"
          >
            <FolderDown className="w-4 h-4 text-emerald-400" />
            Export All (8 Sheets .xlsx)
          </button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-1.5 print:hidden">
        {[
          { id: 'profitability', label: 'Project Profitability', icon: TrendingUp },
          { id: 'income_statement', label: 'Income Statement (P&L)', icon: BarChart3 },
          { id: 'balance_sheet', label: 'Balance Sheet', icon: Scale },
          { id: 'trial_balance', label: 'Trial Balance', icon: Layers },
          { id: 'cash_flow', label: 'Cash Flow Statement', icon: DollarSign },
          { id: 'ar_aging', label: 'Receivables Aging (AR)', icon: Clock, badge: state.clientInvoices.filter(i => i.outstandingAmount > 0).length },
          { id: 'ap_aging', label: 'Payables Aging (AP)', icon: Clock, badge: state.purchases.filter(p => p.outstandingAmount > 0).length },
          { id: 'general_journal', label: 'General Journal (Audit)', icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedReport(tab.id as ReportType)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* GLOBAL QUICK FILTER TOOLBAR (Period Presets & Project Selector) */}
      {/* ============================================================= */}
      <div className="bg-slate-50/90 rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Period:
            </span>

            {[
              { id: 'all', label: 'All Time' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_quarter', label: 'This Quarter' },
              { id: 'this_year', label: 'This Year' },
              { id: 'custom', label: 'Custom Range' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id as DatePreset)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  datePreset === preset.id
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}

            {datePreset !== 'all' && (
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 ml-1">
                {dateRange.label}
              </span>
            )}
          </div>

          {/* Project Selector Quick Filter & Density Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 whitespace-nowrap">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Project:
              </span>
              <select
                value={filterProjectId}
                onChange={(e) => setFilterProjectId(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[240px]"
              >
                <option value="all">All Projects (Consolidated)</option>
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Row Spacing:
              </span>
              <TableDensityToggle variant="segmented" />
            </div>
          </div>
        </div>

        {/* Custom Date Range Inputs (Shown when 'custom' is selected) */}
        {datePreset === 'custom' && (
          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-[11px] text-slate-500 hover:text-rose-600 underline cursor-pointer"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* REPORT CANVAS & REPORT-SPECIFIC QUICK FILTERS                 */}
      {/* ============================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 print:p-0 print:border-none print:shadow-none print:bg-white">
        {/* Printable Official Statement Header - formatted for A4 PDF export */}
        <div className="hidden print:block print-header-container mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <ArtifyLogo className="h-12 w-auto shrink-0" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
                  {selectedReport === 'profitability' && 'Project Profitability & Cost Analysis'}
                  {selectedReport === 'income_statement' && 'Statement of Profit or Loss (Income Statement)'}
                  {selectedReport === 'balance_sheet' && 'Statement of Financial Position (Balance Sheet)'}
                  {selectedReport === 'trial_balance' && 'Trial Balance Statement'}
                  {selectedReport === 'cash_flow' && 'Statement of Cash Flows'}
                  {selectedReport === 'ar_aging' && (isArPrintSelectedOnly && selectedArIds.size > 0 ? 'Accounts Receivable (AR) - Selected Invoices' : 'Accounts Receivable (AR) Aging Summary')}
                  {selectedReport === 'ap_aging' && (isApPrintSelectedOnly && selectedApIds.size > 0 ? 'Accounts Payable (AP) - Selected Bills' : 'Accounts Payable (AP) Aging Summary')}
                  {selectedReport === 'general_journal' && (isJournalPrintSelectedOnly && selectedJournalIds.size > 0 ? 'General Journal - Selected Transaction Records' : 'General Journal & Audit Ledger')}
                </h1>
                <p className="text-xs font-medium text-slate-600 mt-1">
                  Artify Construction Accounting System &bull; Sultanate of Oman &bull; IFRS &amp; GAAP Compliant
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-700 space-y-0.5 shrink-0 pl-4">
              <div><span className="text-slate-500">Period:</span> <strong>{dateRange.label}</strong></div>
              <div>
                <span className="text-slate-500">Scope:</span>{' '}
                <strong>
                  {selectedReport === 'general_journal' && isJournalPrintSelectedOnly && selectedJournalIds.size > 0
                    ? `Selected Transactions (${selectedJournalIds.size} records, ${formatOMR(selectedJournalSum)})`
                    : selectedReport === 'ar_aging' && isArPrintSelectedOnly && selectedArIds.size > 0
                    ? `Selected Invoices (${selectedArIds.size} items)`
                    : selectedReport === 'ap_aging' && isApPrintSelectedOnly && selectedApIds.size > 0
                    ? `Selected Bills (${selectedApIds.size} items)`
                    : selectedProjectObj
                    ? `${selectedProjectObj.name} (${selectedProjectObj.code})`
                    : 'All Projects Consolidated'}
                </strong>
              </div>
              <div><span className="text-slate-500">Currency:</span> <strong>OMR (Numeric 18, 3)</strong></div>
              <div className="print-timestamp-badge">
                <span className="text-slate-500">Printed:</span>{' '}
                <strong className="font-mono text-slate-900">{printTimestamp || getFormattedTimestamp()}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================== */}
        {/* REPORT 1: Project Profitability                             */}
        {/* =========================================================== */}
        {selectedReport === 'profitability' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
              <div>
                <h3 className="text-base font-bold text-slate-900">Project Profitability &amp; Cost Analysis</h3>
                <p className="text-xs text-slate-500">
                  Project Cost = Direct Purchases + Direct Site Expenses. Receipts and disbursements reflect cash flow.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-slate-500">
                  Showing <strong className="text-slate-900">{filteredProfitabilities.length}</strong> of {rawProfitabilities.length} projects
                </div>
                <TableExportButtons
                  tableName="Project Profitability"
                  count={filteredProfitabilities.length}
                  onExportCsv={() => handleExport('csv', 'profitability')}
                  onExportExcel={() => handleExport('excel', 'profitability')}
                  showDensityToggle={true}
                />
              </div>
            </div>

            {/* Quick Filter Bar for Profitability */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
              {/* Margin Quick Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-500" /> Margin:
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
                    onClick={() => setProfitMarginFilter(item.id as any)}
                    className={`px-2 py-1 text-xs rounded-md font-medium cursor-pointer transition-colors ${
                      profitMarginFilter === item.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search project or client..."
                    value={profitSearch}
                    onChange={(e) => setProfitSearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-44"
                  />
                  {profitSearch && (
                    <button
                      onClick={() => setProfitSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  <select
                    value={profitSort}
                    onChange={(e) => setProfitSort(e.target.value as any)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
                  >
                    <option value="profit_desc">Sort: Profit (High &rarr; Low)</option>
                    <option value="margin_desc">Sort: Margin % (High &rarr; Low)</option>
                    <option value="contract_desc">Sort: Contract (High &rarr; Low)</option>
                    <option value="cost_desc">Sort: Cost (High &rarr; Low)</option>
                    <option value="code_asc">Sort: Project Code (A &rarr; Z)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filtered KPI Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50/60 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-[11px] text-slate-500">Contract Portfolio</span>
                <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatOMR(profitKpis.totalContract)}</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Invoiced Revenue</span>
                <div className="font-mono font-bold text-blue-700 text-sm mt-0.5">{formatOMR(profitKpis.totalInvoiced)}</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Total Project Costs</span>
                <div className="font-mono font-bold text-rose-700 text-sm mt-0.5">{formatOMR(profitKpis.totalCost)}</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Net Gross Profit</span>
                <div className="font-mono font-bold text-emerald-700 text-sm mt-0.5">{formatOMR(profitKpis.totalProfit)}</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Weighted Margin</span>
                <div className="font-mono font-bold text-emerald-800 text-sm mt-0.5">{formatPercent(profitKpis.avgMargin)}</div>
              </div>
            </div>

            {/* Profitability Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Project Code</th>
                    <th className="py-2.5 px-3">Project Name</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-right">Contract</th>
                    <th className="py-2.5 px-3 text-right">Invoiced (Rev)</th>
                    <th className="py-2.5 px-3 text-right">Purchases</th>
                    <th className="py-2.5 px-3 text-right">Expenses</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfitabilities.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No projects match the selected quick filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProfitabilities.map((p) => (
                      <tr key={p.projectId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{p.projectCode}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{p.projectName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{p.customerName}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.contractValue)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-blue-700">{formatOMR(p.totalInvoiced)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.totalPurchases)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.totalExpenses)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-rose-700">{formatOMR(p.totalProjectCost)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${p.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatOMR(p.grossProfit)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-semibold ${p.profitMargin >= 15 ? 'text-emerald-700' : p.profitMargin >= 5 ? 'text-blue-700' : 'text-amber-700'}`}>
                          {formatPercent(p.profitMargin)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* REPORT 2: Income Statement (P&L)                            */}
        {/* =========================================================== */}
        {selectedReport === 'income_statement' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">STATEMENT OF PROFIT AND LOSS</h3>
              <p className="text-xs text-slate-500">
                Period: <strong>{dateRange.label}</strong> {selectedProjectObj ? `| Project: ${selectedProjectObj.name}` : '| Consolidated Company-wide'} (OMR)
              </p>
            </div>

            {/* Quick Filter Bar for Income Statement */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Scope:</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                  {selectedProjectObj ? `Project: ${selectedProjectObj.code}` : 'All Projects'}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                  {dateRange.label}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={showIncomePercent}
                    onChange={(e) => setShowIncomePercent(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Show % of Revenue</span>
                </label>
                <TableExportButtons
                  tableName="Income Statement"
                  onExportCsv={() => handleExport('csv', 'income_statement')}
                  onExportExcel={() => handleExport('excel', 'income_statement')}
                  showDensityToggle={true}
                />
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Revenue Section */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px] flex justify-between">
                  <span>Operating Revenue</span>
                  {showIncomePercent && <span>% Revenue</span>}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-700">Contract Billing (Client Invoices &amp; Certified IPCs)</span>
                    <div className="flex items-center gap-6">
                      <span className="font-mono font-semibold text-slate-900">{formatOMR(incomeStatementData.revenueInvoiced)}</span>
                      {showIncomePercent && (
                        <span className="font-mono text-slate-500 w-16 text-right">100.0%</span>
                      )}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Total Operating Revenue</span>
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-blue-700">{formatOMR(incomeStatementData.revenueInvoiced)}</span>
                      {showIncomePercent && (
                        <span className="font-mono text-blue-700 w-16 text-right">100.0%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Costs Section */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px] flex justify-between">
                  <span>Cost of Construction &amp; Direct Site Expenses</span>
                  {showIncomePercent && <span>% Revenue</span>}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-700">Materials, Subcontractors &amp; Equipment Purchases ({incomeStatementData.purchaseCount} bills)</span>
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-slate-900">{formatOMR(incomeStatementData.purchasesCost)}</span>
                      {showIncomePercent && (
                        <span className="font-mono text-slate-500 w-16 text-right">
                          {incomeStatementData.revenueInvoiced > 0
                            ? `${((incomeStatementData.purchasesCost / incomeStatementData.revenueInvoiced) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">Direct Site &amp; Project Expenses (Fuel, Consumables, Labor) ({incomeStatementData.expenseCount} vouchers)</span>
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-slate-900">{formatOMR(incomeStatementData.expensesCost)}</span>
                      {showIncomePercent && (
                        <span className="font-mono text-slate-500 w-16 text-right">
                          {incomeStatementData.revenueInvoiced > 0
                            ? `${((incomeStatementData.expensesCost / incomeStatementData.revenueInvoiced) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Total Cost of Construction</span>
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-rose-700">{formatOMR(incomeStatementData.totalProjectCosts)}</span>
                      {showIncomePercent && (
                        <span className="font-mono text-rose-700 w-16 text-right">
                          {incomeStatementData.revenueInvoiced > 0
                            ? `${((incomeStatementData.totalProjectCosts / incomeStatementData.revenueInvoiced) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Gross Profit Card */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-emerald-900">NET CONSTRUCTION PROFIT</span>
                  <p className="text-[11px] text-emerald-700">
                    Operating Revenue minus Total Construction Costs ({dateRange.label})
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold font-mono ${incomeStatementData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatOMR(incomeStatementData.netProfit)}
                  </div>
                  <div className="text-xs font-semibold text-emerald-800">
                    Gross Margin: {formatPercent(incomeStatementData.profitMargin)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* REPORT 3: Balance Sheet                                     */}
        {/* =========================================================== */}
        {selectedReport === 'balance_sheet' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)</h3>
              <p className="text-xs text-slate-500">As at {new Date().toISOString().split('T')[0]} (OMR)</p>
            </div>

            {/* Balance Sheet Quick Toggles */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">As-of Date:</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                  Current (Live Ledger)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={hideZeroBalanceAccounts}
                    onChange={(e) => setHideZeroBalanceAccounts(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Hide Zero Balances</span>
                </label>
                <TableExportButtons
                  tableName="Balance Sheet"
                  onExportCsv={() => handleExport('csv', 'balance_sheet')}
                  onExportExcel={() => handleExport('excel', 'balance_sheet')}
                  showDensityToggle={true}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Assets */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Current Assets
                  </div>
                  <div className="p-4 space-y-2">
                    {(!hideZeroBalanceAccounts || summary.totalBankBalance > 0) && (
                      <div className="flex justify-between">
                        <span className="text-slate-700">Bank Accounts</span>
                        <span className="font-mono text-slate-900">{formatOMR(summary.totalBankBalance)}</span>
                      </div>
                    )}
                    {(!hideZeroBalanceAccounts || summary.totalCashBalance > 0) && (
                      <div className="flex justify-between">
                        <span className="text-slate-700">Cash in Hand</span>
                        <span className="font-mono text-slate-900">{formatOMR(summary.totalCashBalance)}</span>
                      </div>
                    )}
                    {(!hideZeroBalanceAccounts || summary.totalPettyCashBalance > 0) && (
                      <div className="flex justify-between">
                        <span className="text-slate-700">Petty Cash Floats</span>
                        <span className="font-mono text-slate-900">{formatOMR(summary.totalPettyCashBalance)}</span>
                      </div>
                    )}
                    {(!hideZeroBalanceAccounts || summary.totalReceivables > 0) && (
                      <div className="flex justify-between">
                        <span className="text-slate-700">Accounts Receivable (Clients)</span>
                        <span className="font-mono text-slate-900">{formatOMR(summary.totalReceivables)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                  <span>TOTAL ASSETS</span>
                  <span className="font-mono text-emerald-700">
                    {formatOMR(summary.totalLiquidFunds + summary.totalReceivables)}
                  </span>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Liabilities &amp; Equity
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="font-semibold text-slate-800 text-[11px] pt-1">Current Liabilities</div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Accounts Payable (Vendors)</span>
                      <span className="font-mono text-slate-900">{formatOMR(summary.totalPayables)}</span>
                    </div>

                    <div className="font-semibold text-slate-800 text-[11px] pt-3">Equity</div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Current Period Net Profit</span>
                      <span className="font-mono text-slate-900">
                        {formatOMR(summary.totalLiquidFunds + summary.totalReceivables - summary.totalPayables)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                  <span>TOTAL LIABILITIES &amp; EQUITY</span>
                  <span className="font-mono text-emerald-700">
                    {formatOMR(summary.totalLiquidFunds + summary.totalReceivables)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* REPORT 4: Trial Balance                                     */}
        {/* =========================================================== */}
        {selectedReport === 'trial_balance' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">TRIAL BALANCE</h3>
              <p className="text-xs text-slate-500">Double-Entry Ledger Equality Verification (OMR)</p>
            </div>

            {/* Trial Balance Quick Filter Pills */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs print:hidden">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-500" /> Class:
                </span>
                {[
                  { id: 'all', label: 'All Accounts' },
                  { id: 'assets', label: 'Assets (1xxx)' },
                  { id: 'liabilities', label: 'Liabilities (2xxx)' },
                  { id: 'revenue', label: 'Revenue (4xxx)' },
                  { id: 'expenses', label: 'Costs & Exp (5xxx)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTrialAccountClass(item.id as any)}
                    className={`px-2 py-1 text-xs rounded-md font-medium cursor-pointer transition-colors ${
                      trialAccountClass === item.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search account..."
                    value={trialSearch}
                    onChange={(e) => setTrialSearch(e.target.value)}
                    className="pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-36"
                  />
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={hideZeroTrial}
                    onChange={(e) => setHideZeroTrial(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Hide Zero</span>
                </label>

                <TableExportButtons
                  tableName="Trial Balance"
                  onExportCsv={() => handleExport('csv', 'trial_balance')}
                  onExportExcel={() => handleExport('excel', 'trial_balance')}
                  showDensityToggle={true}
                />
              </div>
            </div>

            {/* Trial Balance Table */}
            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Account Code</th>
                  <th className="py-2.5 px-3">Account Name</th>
                  <th className="py-2.5 px-3 text-right">Debit (OMR)</th>
                  <th className="py-2.5 px-3 text-right">Credit (OMR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {trialBalanceRows.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-500">{r.code}</td>
                    <td className="py-2 px-3 font-sans text-slate-800 font-medium">{r.name}</td>
                    <td className="py-2 px-3 text-right text-slate-900">{r.debit > 0 ? formatOMR(r.debit) : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-900">{r.credit > 0 ? formatOMR(r.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================== */}
        {/* REPORT 5: Cash Flow Statement                               */}
        {/* =========================================================== */}
        {selectedReport === 'cash_flow' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">STATEMENT OF CASH FLOWS</h3>
              <p className="text-xs text-slate-500">
                Direct Method for: <strong>{dateRange.label}</strong> {selectedProjectObj ? `| Project: ${selectedProjectObj.name}` : '| Consolidated'} (OMR)
              </p>
            </div>

            {/* Quick Scope & Export Bar */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Scope:</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                  {selectedProjectObj ? `Project: ${selectedProjectObj.code}` : 'All Projects'}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                  {dateRange.label}
                </span>
              </div>
              <TableExportButtons
                tableName="Cash Flow Statement"
                onExportCsv={() => handleExport('csv', 'cash_flow')}
                onExportExcel={() => handleExport('excel', 'cash_flow')}
                showDensityToggle={true}
              />
            </div>

            {/* Quick KPI Strip */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                <span className="text-[11px] text-emerald-800 font-semibold">Total Cash Inflows</span>
                <div className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                  {formatOMR(cashFlowData.totalReceipts)}
                </div>
                <span className="text-[10px] text-emerald-600">{cashFlowData.receiptCount} receipts</span>
              </div>
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg">
                <span className="text-[11px] text-rose-800 font-semibold">Total Cash Outflows</span>
                <div className="font-mono font-bold text-rose-700 text-sm mt-0.5">
                  ({formatOMR(cashFlowData.totalOutflows)})
                </div>
                <span className="text-[10px] text-rose-600">{cashFlowData.paymentCount + cashFlowData.expenseCount} payments</span>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
                <span className="text-[11px] text-blue-800 font-semibold">Net Operating Cash</span>
                <div className={`font-mono font-bold text-sm mt-0.5 ${cashFlowData.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatOMR(cashFlowData.netCashFlow)}
                </div>
                <span className="text-[10px] text-blue-600">{dateRange.label}</span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Cash Flow from Operations ({dateRange.label})
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Cash Received from Clients / IPC Collections</span>
                  <span className="font-mono text-emerald-700 font-semibold">{formatOMR(cashFlowData.totalReceipts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Cash Paid to Vendors &amp; Subcontractors</span>
                  <span className="font-mono text-rose-700">({formatOMR(cashFlowData.totalVendorPaid)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Cash Paid for Direct Site Expenses (Vouchers)</span>
                  <span className="font-mono text-rose-700">({formatOMR(cashFlowData.totalExpensesPaid)})</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                  <span>Net Cash from Operating Activities</span>
                  <span className={`font-mono ${cashFlowData.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatOMR(cashFlowData.netCashFlow)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* REPORT 6: AR Aging (Receivables)                            */}
        {/* =========================================================== */}
        {selectedReport === 'ar_aging' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Accounts Receivable Aging Schedule</h3>
                <p className="text-xs text-slate-500">Client Invoices and IPCs pending collection categorized by aging brackets</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-slate-500">
                  Total Outstanding: <strong className="font-mono text-blue-700">{formatOMR(arTotals.totalOutstanding)}</strong> ({arTotals.count} invoices)
                </div>
                <TableExportButtons
                  tableName="AR Aging Schedule"
                  count={filteredArAging.length}
                  onExportCsv={() => handleExport('csv', 'ar_aging')}
                  onExportExcel={() => handleExport('excel', 'ar_aging')}
                  showDensityToggle={true}
                />
              </div>
            </div>

            {/* Quick Filters for AR Aging */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-3 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Aging Bracket Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" /> Bracket:
                  </span>
                  {[
                    { id: 'all', label: 'All Invoices' },
                    { id: '0_30', label: 'Current (0-30d)' },
                    { id: '31_60', label: '31 - 60d' },
                    { id: '61_90', label: '61 - 90d' },
                    { id: 'over_90', label: '> 90d Overdue' },
                  ].map((bracket) => (
                    <button
                      key={bracket.id}
                      onClick={() => setArAgingBracket(bracket.id as any)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                        arAgingBracket === bracket.id
                          ? 'bg-slate-900 text-white shadow-xs font-semibold'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {bracket.label}
                    </button>
                  ))}
                </div>

                {/* Amount Threshold Pills */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Min Balance:</span>
                  {[
                    { val: 0, label: 'All' },
                    { val: 1000, label: '>1k' },
                    { val: 5000, label: '>5k' },
                    { val: 10000, label: '>10k' },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => setArMinAmount(btn.val)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium cursor-pointer ${
                        arMinAmount === btn.val
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Dropdown & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 text-xs">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-700 font-medium">Customer:</span>
                  <select
                    value={arCustomerId}
                    onChange={(e) => setArCustomerId(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none"
                  >
                    <option value="all">All Customers</option>
                    {state.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search invoice, customer, project..."
                    value={arSearch}
                    onChange={(e) => setArSearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-64"
                  />
                  {arSearch && (
                    <button
                      onClick={() => setArSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selection Banner for AR Invoices */}
            {selectedArIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span className="text-xs font-semibold text-blue-900">
                    {selectedArIds.size} of {filteredArAging.length} receivables selected for combined printing
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPrintPreview(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-blue-300 text-blue-900 hover:bg-blue-100/60 cursor-pointer shadow-xs transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Print Preview
                  </button>
                  <button
                    onClick={() => handlePrint(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Selected Invoices as PDF
                  </button>
                  <button
                    onClick={() => setSelectedArIds(new Set())}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-100/50 cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* AR Aging Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={isAllArSelected}
                        onChange={handleSelectAllAr}
                        title={isAllArSelected ? 'Deselect all' : 'Select all'}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3 text-right">Total Invoiced</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Aging Bracket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredArAging.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No outstanding receivables match the current filters.
                      </td>
                    </tr>
                  ) : (
                    (isArPrintSelectedOnly && selectedArIds.size > 0
                      ? filteredArAging.filter((inv) => selectedArIds.has(inv.id))
                      : filteredArAging
                    ).map((inv, idx) => {
                      const isSelected = selectedArIds.has(inv.id);
                      return (
                        <tr
                          key={`${inv.id}-${idx}`}
                          onClick={() => handleToggleArSelect(inv.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td
                            className="py-2.5 px-3 text-center print:hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleArSelect(inv.id)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{inv.invoiceNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{inv.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{inv.customerName}</td>
                          <td className="py-2.5 px-3 text-slate-700">{inv.projectName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(inv.amount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatOMR(inv.receivedAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">{formatOMR(inv.outstandingAmount)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${inv.badgeClass}`}>
                              {inv.bracketLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* REPORT 7: AP Aging (Payables)                               */}
        {/* =========================================================== */}
        {selectedReport === 'ap_aging' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Accounts Payable Aging Schedule</h3>
                <p className="text-xs text-slate-500">Supplier bills and subcontractor certificates pending settlement</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-slate-500">
                  Total Payable: <strong className="font-mono text-amber-700">{formatOMR(apTotals.totalOutstanding)}</strong> ({apTotals.count} bills)
                </div>
                <TableExportButtons
                  tableName="AP Aging Schedule"
                  count={filteredApAging.length}
                  onExportCsv={() => handleExport('csv', 'ap_aging')}
                  onExportExcel={() => handleExport('excel', 'ap_aging')}
                  showDensityToggle={true}
                />
              </div>
            </div>

            {/* Quick Filters for AP Aging */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-3 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Aging Bracket Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" /> Bracket:
                  </span>
                  {[
                    { id: 'all', label: 'All Bills' },
                    { id: '0_30', label: 'Current (0-30d)' },
                    { id: '31_60', label: '31 - 60d' },
                    { id: '61_90', label: '61 - 90d' },
                    { id: 'over_90', label: '> 90d Overdue' },
                  ].map((bracket) => (
                    <button
                      key={bracket.id}
                      onClick={() => setApAgingBracket(bracket.id as any)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                        apAgingBracket === bracket.id
                          ? 'bg-slate-900 text-white shadow-xs font-semibold'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {bracket.label}
                    </button>
                  ))}
                </div>

                {/* Amount Threshold Pills */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Min Balance:</span>
                  {[
                    { val: 0, label: 'All' },
                    { val: 1000, label: '>1k' },
                    { val: 5000, label: '>5k' },
                    { val: 10000, label: '>10k' },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => setApMinAmount(btn.val)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium cursor-pointer ${
                        apMinAmount === btn.val
                          ? 'bg-amber-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vendor & Category Dropdowns + Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-700 font-medium">Vendor:</span>
                    <select
                      value={apVendorId}
                      onChange={(e) => setApVendorId(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none max-w-[180px]"
                    >
                      <option value="all">All Vendors</option>
                      {state.vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-medium">Category:</span>
                    <select
                      value={apCategory}
                      onChange={(e) => setApCategory(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="all">All Categories</option>
                      <option value="Materials">Materials</option>
                      <option value="Subcontractor">Subcontractor</option>
                      <option value="Equipment Rental">Equipment Rental</option>
                      <option value="Fuel & Consumables">Fuel &amp; Consumables</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search bill, vendor, project..."
                    value={apSearch}
                    onChange={(e) => setApSearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-64"
                  />
                  {apSearch && (
                    <button
                      onClick={() => setApSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selection Banner for AP Bills */}
            {selectedApIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span className="text-xs font-semibold text-blue-900">
                    {selectedApIds.size} of {filteredApAging.length} payable bills selected for combined printing
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPrintPreview(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-blue-300 text-blue-900 hover:bg-blue-100/60 cursor-pointer shadow-xs transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Print Preview
                  </button>
                  <button
                    onClick={() => handlePrint(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Selected Bills as PDF
                  </button>
                  <button
                    onClick={() => setSelectedApIds(new Set())}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-100/50 cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* AP Aging Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={isAllApSelected}
                        onChange={handleSelectAllAp}
                        title={isAllApSelected ? 'Deselect all' : 'Select all'}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Bill #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vendor</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Bill Amount</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Aging Bracket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApAging.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No outstanding payables match the current filters.
                      </td>
                    </tr>
                  ) : (
                    (isApPrintSelectedOnly && selectedApIds.size > 0
                      ? filteredApAging.filter((p) => selectedApIds.has(p.id))
                      : filteredApAging
                    ).map((p, idx) => {
                      const isSelected = selectedApIds.has(p.id);
                      return (
                        <tr
                          key={`${p.id}-${idx}`}
                          onClick={() => handleToggleApSelect(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td
                            className="py-2.5 px-3 text-center print:hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleApSelect(p.id)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{p.purchaseInvoiceNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{p.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{p.vendorName}</td>
                          <td className="py-2.5 px-3 text-slate-700">{p.projectName}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {p.purchaseCategory || 'General'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.amount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatOMR(p.paidAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">{formatOMR(p.outstandingAmount)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${p.badgeClass}`}>
                              {p.bracketLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* REPORT 8: General Journal (Audit Traceability)              */}
        {/* =========================================================== */}
        {selectedReport === 'general_journal' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">General Journal &amp; Audit Traceability</h3>
                <p className="text-xs text-slate-500">
                  Double-entry transactions linked to Projects, Customers, and Vendors with NUMERIC(18,3) OMR precision
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  Showing <strong className="text-blue-700">{journalTotals.count}</strong> entries (Volume: {formatOMR(journalTotals.totalVolume)})
                </span>
                <TableExportButtons
                  tableName="General Journal"
                  count={journalTotals.count}
                  onExportCsv={() => handleExport('csv', 'general_journal')}
                  onExportExcel={() => handleExport('excel', 'general_journal')}
                  showDensityToggle={true}
                />
              </div>
            </div>

            {/* Quick Filters for General Journal */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-3 print:hidden">
              {/* Source Type Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-500" /> Source:
                </span>
                {[
                  { id: 'all', label: 'All Sources' },
                  { id: 'client_invoice', label: 'Invoices (IPC)' },
                  { id: 'purchase', label: 'Purchases' },
                  { id: 'direct_expense', label: 'Direct Expenses' },
                  { id: 'money_in', label: 'Receipts (In)' },
                  { id: 'money_out', label: 'Payments (Out)' },
                  { id: 'transfer', label: 'Transfers' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setJournalSourceType(st.id)}
                    className={`px-2 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                      journalSourceType === st.id
                        ? 'bg-slate-900 text-white shadow-xs font-semibold'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Status, Entity Trace & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-medium">Status:</span>
                    <select
                      value={journalStatus}
                      onChange={(e) => setJournalStatus(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="posted">Posted Only</option>
                      <option value="reversed">Reversed Only</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-medium">Trace Link:</span>
                    <select
                      value={journalEntityTrace}
                      onChange={(e) => setJournalEntityTrace(e.target.value as any)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="all">All Entities</option>
                      <option value="project">Project-Linked Only</option>
                      <option value="customer">Customer-Linked Only</option>
                      <option value="vendor">Vendor-Linked Only</option>
                      <option value="internal">Treasury / Internal Only</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search entry #, account, text..."
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-64"
                  />
                  {journalSearch && (
                    <button
                      onClick={() => setJournalSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selection Banner for General Journal Transactions */}
            {selectedJournalIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span className="text-xs font-semibold text-blue-900">
                    {selectedJournalIds.size} of {filteredJournalEntries.length} transactions selected &bull; Total: {formatOMR(selectedJournalSum)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPrintPreview(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-blue-300 text-blue-900 hover:bg-blue-100/60 cursor-pointer shadow-xs transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Print Preview
                  </button>
                  <button
                    onClick={() => handlePrint(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Selected Transactions as Combined PDF
                  </button>
                  <button
                    onClick={() => {
                      const targetEntries = filteredJournalEntries.filter((je) => selectedJournalIds.has(je.id));
                      const data = targetEntries.map((je) => ({
                        'Entry #': je.entryNumber,
                        'Date': je.date,
                        'Source Type': je.sourceType,
                        'Debit Account': je.debitAccount,
                        'Credit Account': je.creditAccount,
                        'Amount (OMR)': je.amount,
                        'Status': je.status,
                      }));
                      exportToExcel({
                        filename: `Journal_Selected_${new Date().toISOString().split('T')[0]}`,
                        sheetName: 'Selected Entries',
                        title: 'SELECTED JOURNAL TRANSACTIONS',
                        companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
                        currency: 'OMR',
                        data,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-100/50 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    Export Selected (Excel)
                  </button>
                  <button
                    onClick={() => setSelectedJournalIds(new Set())}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-100/50 cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* General Journal Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={isAllJournalSelected}
                        onChange={handleSelectAllJournal}
                        title={isAllJournalSelected ? 'Deselect all' : 'Select all'}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Entry #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Source Type</th>
                    <th className="py-2.5 px-3">Audit Trace (Entity Link)</th>
                    <th className="py-2.5 px-3">Debit Account</th>
                    <th className="py-2.5 px-3">Credit Account</th>
                    <th className="py-2.5 px-3 text-right">Amount (OMR)</th>
                    <th className="py-2.5 px-3 text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredJournalEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No journal entries match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    (isJournalPrintSelectedOnly && selectedJournalIds.size > 0
                      ? filteredJournalEntries.filter((je) => selectedJournalIds.has(je.id))
                      : filteredJournalEntries
                    ).map((je, idx) => {
                      const isSelected = selectedJournalIds.has(je.id);
                      const prj = state.projects.find((p) => p.id === je.projectId);
                      const cust = state.customers.find((c) => c.id === je.customerId);
                      const vend = state.vendors.find((v) => v.id === je.vendorId);

                      return (
                        <tr
                          key={`${je.id}-${idx}`}
                          onClick={() => handleToggleJournalSelect(je.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td
                            className="py-2.5 px-3 text-center print:hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleJournalSelect(je.id)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{je.entryNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{je.date}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                              {je.sourceType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-0.5">
                              {prj && (
                                <span className="text-[11px] text-indigo-700 font-medium">
                                  📁 Project: {prj.code} - {prj.name}
                                </span>
                              )}
                              {cust && (
                                <span className="text-[11px] text-blue-700 font-medium">
                                  👤 Customer: {cust.name}
                                </span>
                              )}
                              {vend && (
                                <span className="text-[11px] text-amber-800 font-medium">
                                  🏢 Vendor: {vend.name}
                                </span>
                              )}
                              {!prj && !cust && !vend && (
                                <span className="text-[11px] text-slate-400 italic">
                                  Internal Transfer / Balance Sheet
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-emerald-800">{je.debitAccount}</td>
                          <td className="py-2.5 px-3 font-medium text-rose-800">{je.creditAccount}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatOMR(je.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                je.status === 'posted'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : je.status === 'reversed'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200 line-through'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {je.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Printable Official Signatory & Audit Verification Block (Visible only during A4 Print / PDF Export) */}
        <div className="hidden print:block print-signatory-block mt-8 pt-6 border-t border-slate-300">
          <div className="grid grid-cols-3 gap-6 text-xs text-slate-800">
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-900">Prepared By</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Project Accountant / Financial Analyst</p>
              <div className="h-12 border-b border-dashed border-slate-300 mx-6 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">Signature &amp; Date</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-900">Verified &amp; Reconciled By</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Chief Financial Officer / Head of Finance</p>
              <div className="h-12 border-b border-dashed border-slate-300 mx-6 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">Signature &amp; Date</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-900">Approved By</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Managing Director / Partner</p>
              <div className="h-12 border-b border-dashed border-slate-300 mx-6 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">Corporate Seal &amp; Date</p>
            </div>
          </div>
          <div className="print-timestamp-footer mt-6 pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-500 font-mono">
            <span>Artify Construction Accounting System &bull; Computer Generated Official Report (Sultanate of Oman)</span>
            <span>Printed: {printTimestamp || getFormattedTimestamp()} &bull; Ref: ART-REP-{selectedReport.toUpperCase()}-{new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        onConfirmPrint={handleConfirmPrintFromModal}
        title={previewConfig.title}
        subtitle="Al Tasneem & Partners Construction LLC • Sultanate of Oman • IFRS & GAAP Governance"
        docRef={previewConfig.docRef}
        scope={previewConfig.scope}
        period={
          datePreset !== 'all'
            ? `${dateRange.startDate || '—'} to ${dateRange.endDate || '—'}`
            : 'Fiscal Year to Date'
        }
        timestamp={printTimestamp || getFormattedTimestamp()}
        columns={previewConfig.columns}
        data={previewConfig.data}
        summaryRow={previewConfig.summaryRow}
        emptyMessage={previewConfig.emptyMessage}
        customFooterNote="Artify Construction Accounting System • Computer Generated Official Report (Sultanate of Oman)"
      />
    </div>
  );
};

export default ReportsView;
