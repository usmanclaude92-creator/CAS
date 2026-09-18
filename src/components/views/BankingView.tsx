import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Landmark,
  Wallet,
  Coins,
  ArrowRightLeft,
  Plus,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  FileText,
  Filter,
  Search,
  X,
  Calendar,
  RotateCcw,
  ChevronDown,
  Download,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, addMoney } from '../../utils/formatters';
import { exportData } from '../../services/exportService';
import {
  DatePreset,
  getDateRangeFromPreset,
  isDateInRange,
} from '../../utils/reportFilters';
import { TreasuryAccountType } from '../../types';

interface BankingViewProps {
  onOpenTransfer: () => void;
  onOpenNewBankAccount: () => void;
  onOpenMoneyIn: () => void;
  onOpenMoneyOut: () => void;
  selectedAccountId?: string;
  onSelectAccount?: (id: string) => void;
}

export const BankingView: React.FC<BankingViewProps> = ({
  onOpenTransfer,
  onOpenNewBankAccount,
  onOpenMoneyIn,
  onOpenMoneyOut,
  selectedAccountId: controlledAccountId,
  onSelectAccount,
}) => {
  const [internalAccountId, setInternalAccountId] = useState<string>(() => {
    return controlledAccountId || accountingService.getActiveTreasuryAccountId() || 'all';
  });

  const selectedAccountId = controlledAccountId !== undefined ? controlledAccountId : internalAccountId;

  const handleSelectAccount = (id: string) => {
    setInternalAccountId(id);
    accountingService.setActiveTreasuryAccountId(id);
    if (onSelectAccount) {
      onSelectAccount(id);
    }
  };

  const [activeTab, setActiveTab] = useState<'treasury_ledger' | 'transfers'>('treasury_ledger');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'MONEY_IN' | 'MONEY_OUT' | 'TRANSFER'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const dateRange = useMemo(() => {
    return getDateRangeFromPreset(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  const state = accountingService.getState();
  const summary = accountingService.getDashboardSummary();

  // Resolve selected account entity and its account type
  const selectedAccount = useMemo(() => {
    if (selectedAccountId === 'all' || selectedAccountId.startsWith('group:')) return null;
    return (
      state.bankAccounts.find((b) => b.id === selectedAccountId) ||
      state.cashAccounts.find((c) => c.id === selectedAccountId) ||
      state.pettyCashAccounts.find((p) => p.id === selectedAccountId) ||
      null
    );
  }, [selectedAccountId, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  const accountTypeFilter = useMemo<TreasuryAccountType | undefined>(() => {
    if (selectedAccountId.startsWith('group:')) {
      return selectedAccountId.replace('group:', '') as TreasuryAccountType;
    }
    if (selectedAccount) {
      if (state.bankAccounts.some((b) => b.id === selectedAccountId)) return 'bank';
      if (state.cashAccounts.some((c) => c.id === selectedAccountId)) return 'cash';
      if (state.pettyCashAccounts.some((p) => p.id === selectedAccountId)) return 'petty_cash';
    }
    return undefined;
  }, [selectedAccountId, selectedAccount, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  const effectiveAccountId = selectedAccount ? selectedAccountId : undefined;

  const rawTreasuryLedger = useMemo(() => {
    return accountingService.getTreasuryLedger(accountTypeFilter, effectiveAccountId);
  }, [accountTypeFilter, effectiveAccountId, state]);

  const treasuryLedger = useMemo(() => {
    return rawTreasuryLedger.filter((row) => {
      if (!isDateInRange(row.date, dateRange.startDate, dateRange.endDate)) return false;

      // Filter by Type (Receipts, Payments, Transfers)
      if (typeFilter !== 'all') {
        const typeNormalized = (row.type || '').toLowerCase();
        if (typeFilter === 'MONEY_IN') {
          const isReceipt =
            typeNormalized.includes('in') ||
            typeNormalized.includes('receipt') ||
            typeNormalized.includes('opening') ||
            (row.receipt !== undefined && row.receipt > 0 && (!row.payment || row.payment === 0));
          if (!isReceipt) return false;
        } else if (typeFilter === 'MONEY_OUT') {
          const isPayment =
            typeNormalized.includes('out') ||
            typeNormalized.includes('expense') ||
            typeNormalized.includes('payment') ||
            (row.payment !== undefined && row.payment > 0 && (!row.receipt || row.receipt === 0));
          if (!isPayment) return false;
        } else if (typeFilter === 'TRANSFER') {
          const isTransfer = typeNormalized.includes('transfer');
          if (!isTransfer) return false;
        }
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = (row.documentRef || '').toLowerCase().includes(q);
        const matchParty = (row.party || row.partyName || '').toLowerCase().includes(q);
        const matchDesc = (row.description || '').toLowerCase().includes(q);
        const matchAcc = (row.accountName || '').toLowerCase().includes(q);
        const matchType = (row.type || '').toLowerCase().includes(q);
        if (!matchRef && !matchParty && !matchDesc && !matchAcc && !matchType) return false;
      }
      return true;
    });
  }, [rawTreasuryLedger, dateRange, typeFilter, searchQuery]);

  const ledgerTotals = useMemo(() => {
    const totalReceipts = treasuryLedger.reduce((sum, r) => addMoney(sum, r.receipt || 0), 0);
    const totalPayments = treasuryLedger.reduce((sum, r) => addMoney(sum, r.payment || 0), 0);
    const closingBalance = treasuryLedger.length > 0 ? (treasuryLedger[treasuryLedger.length - 1].runningBalance ?? 0) : 0;
    return { totalReceipts, totalPayments, closingBalance, count: treasuryLedger.length };
  }, [treasuryLedger]);

  // Export visible data with identical columns and format as displayed on screen
  const handleExportData = (format: 'xlsx' | 'csv' | 'pdf' = 'xlsx') => {
    const dateStamp = new Date().toISOString().split('T')[0];

    if (activeTab === 'transfers') {
      const exportOpts = {
        filename: `Artify_Internal_Transfers_${dateStamp}`,
        title: 'Banking & Treasury Operations - Internal Transfers Register',
        subtitle: `Internal transfers between corporate bank accounts, cash vaults, and site floats`,
        sheetName: 'Internal Transfers',
        data: state.transfers || [],
        columns: [
          { header: 'DATE', key: 'date', width: 14 },
          { header: 'DOC REF', key: 'documentRef', width: 16 },
          {
            header: 'TRANSFER FROM',
            key: 'transferFromName',
            width: 24,
            format: (val: any, row: any) => `${row.transferFromName} (${(row.transferFromType || '').replace('_', ' ')})`,
          },
          {
            header: 'TRANSFER TO',
            key: 'transferToName',
            width: 24,
            format: (val: any, row: any) => `${row.transferToName} (${(row.transferToType || '').replace('_', ' ')})`,
          },
          {
            header: 'AMOUNT',
            key: 'amount',
            width: 18,
            align: 'right' as const,
            format: (val: any) => formatOMR(val || 0),
          },
          { header: 'REMARKS', key: 'remarks', width: 28, format: (val: any) => val || '—' },
          {
            header: 'ATTACHMENT',
            key: 'attachmentUrl',
            width: 16,
            align: 'center' as const,
            format: (val: any) => (val ? 'Attachment Available' : '—'),
          },
        ],
        summaryTotals: {
          transferFromName: 'TOTAL TRANSFERS',
          amount: formatOMR(state.transfers.reduce((sum, tr) => sum + (tr.amount || 0), 0)),
        },
      };

      exportData(format, exportOpts);
      return;
    }

    // Treasury Ledger Export: Maintain the EXACT table format and data as displayed on screen
    const accountLabel = selectedAccount
      ? `${selectedAccount.accountName} (${(selectedAccount as any).bankName || (selectedAccount as any).accountType || 'Treasury'})`
      : selectedAccountId.startsWith('group:')
      ? `All ${selectedAccountId.replace('group:', '').replace('_', ' ')} accounts`
      : 'All Bank & Cash Accounts';

    const exportOpts = {
      filename: `Artify_Bank_Cash_Book_${dateStamp}`,
      title: 'Banking & Treasury Operations - Bank & Cash Book Ledger',
      subtitle: `Account: ${accountLabel} • Period: ${dateRange.label.toUpperCase()}`,
      sheetName: 'Bank & Cash Book',
      data: treasuryLedger,
      columns: [
        { header: 'DATE', key: 'date', width: 14 },
        { header: 'DOC REF', key: 'documentRef', width: 16 },
        { header: 'ACCOUNT', key: 'accountName', width: 22 },
        { header: 'TYPE', key: 'type', width: 16 },
        {
          header: 'PARTY / DETAIL',
          key: 'party',
          width: 22,
          format: (val: any, row: any) => row.party || row.partyName || '—',
        },
        { header: 'DESCRIPTION', key: 'description', width: 34 },
        {
          header: 'RECEIPT (DR)',
          key: 'receipt',
          width: 16,
          align: 'right' as const,
          format: (val: any) => (val && val > 0 ? formatOMR(val) : '—'),
        },
        {
          header: 'PAYMENT (CR)',
          key: 'payment',
          width: 16,
          align: 'right' as const,
          format: (val: any) => (val && val > 0 ? formatOMR(val) : '—'),
        },
        {
          header: 'RUNNING BALANCE',
          key: 'runningBalance',
          width: 18,
          align: 'right' as const,
          format: (val: any) => formatOMR(val ?? 0),
        },
      ],
      summaryTotals: {
        accountName: 'TOTALS',
        receipt: formatOMR(ledgerTotals.totalReceipts),
        payment: formatOMR(ledgerTotals.totalPayments),
        runningBalance: formatOMR(ledgerTotals.closingBalance),
      },
    };

    exportData(format, exportOpts);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Banking &amp; Treasury Operations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Commercial Bank Accounts, Cash in Hand, Site Petty Cash floats, and Zero-Revenue Internal Transfers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenTransfer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-700 hover:bg-indigo-600 cursor-pointer shadow"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            + Internal Transfer
          </button>
          <button
            onClick={onOpenMoneyIn}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-700 hover:bg-emerald-600 cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            + Money In
          </button>
          <button
            onClick={onOpenMoneyOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            + Money Out
          </button>
          <button
            onClick={onOpenNewBankAccount}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            Add Bank A/C
          </button>
          {/* Export Dropdown Menu with Screen Format Alignment */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
              title="Export visible table data matching screen format"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export {activeTab === 'treasury_ledger' ? 'Bank Book' : 'Transfers'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 text-xs">
                <button
                  onClick={() => {
                    handleExportData('xlsx');
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-emerald-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-semibold">Excel Workbook (.xlsx)</div>
                    <div className="text-[10px] text-slate-400">Exact on-screen table format</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportData('csv');
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-semibold">CSV (.csv)</div>
                    <div className="text-[10px] text-slate-400">Plain comma-separated table</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportData('pdf');
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-rose-600" />
                  <div>
                    <div className="font-semibold">PDF Document</div>
                    <div className="text-[10px] text-slate-400">Formatted landscape report</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Treasury Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bank Accounts Overview */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bank Accounts</h3>
                <p className="text-[11px] text-slate-500">{state.bankAccounts.length} Registered Accounts</p>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-slate-900">
              {formatOMR(summary.totalBankBalance)}
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            {state.bankAccounts.map((b) => (
              <div
                key={b.id}
                onClick={() => handleSelectAccount(selectedAccountId === b.id ? 'all' : b.id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedAccountId === b.id
                    ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                    : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between font-medium text-slate-900">
                  <span>{b.bankName}</span>
                  <span className="font-mono font-bold text-blue-700">{formatOMR(b.currentBalance)}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                  <span>{b.accountName}</span>
                  <span className="font-mono text-[10px] text-slate-400">{b.accountNumber}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cash in Hand */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cash in Hand</h3>
                <p className="text-[11px] text-slate-500">Main Cash Chest &amp; Office Vault</p>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-slate-900">
              {formatOMR(summary.totalCashBalance)}
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            {state.cashAccounts.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectAccount(selectedAccountId === c.id ? 'all' : c.id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedAccountId === c.id
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                    : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between font-medium text-slate-900">
                  <span>{c.accountName}</span>
                  <span className="font-mono font-bold text-emerald-700">{formatOMR(c.currentBalance)}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Opening: {formatOMR(c.openingBalance)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Petty Cash */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Petty Cash Floats</h3>
                <p className="text-[11px] text-slate-500">Site Engineer &amp; Imprest Accounts</p>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-slate-900">
              {formatOMR(summary.totalPettyCashBalance)}
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            {state.pettyCashAccounts.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectAccount(selectedAccountId === p.id ? 'all' : p.id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedAccountId === p.id
                    ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                    : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between font-medium text-slate-900">
                  <span>{p.accountName}</span>
                  <span className="font-mono font-bold text-amber-700">{formatOMR(p.currentBalance)}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Custodian / Site float balance
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Treasury Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('treasury_ledger')}
              className={`text-xs font-semibold pb-1 cursor-pointer transition-colors border-b-2 ${
                activeTab === 'treasury_ledger'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Bank &amp; Cash Book Ledger ({treasuryLedger.length})
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={`text-xs font-semibold pb-1 cursor-pointer transition-colors border-b-2 ${
                activeTab === 'transfers'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Internal Transfers ({state.transfers.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filter Account:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => handleSelectAccount(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Bank &amp; Cash Accounts --</option>
              <optgroup label="Account Categories">
                <option value="group:bank">All Bank Accounts</option>
                <option value="group:cash">All Cash in Hand</option>
                <option value="group:petty_cash">All Petty Cash Accounts</option>
              </optgroup>
              <optgroup label="Bank Accounts">
                {state.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountName}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cash Accounts">
                {state.cashAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.accountName}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Petty Cash">
                {state.pettyCashAccounts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.accountName}
                  </option>
                ))}
              </optgroup>
            </select>
            {selectedAccountId !== 'all' && (
              <button
                onClick={() => handleSelectAccount('all')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title="Clear account filter"
              >
                <span>Reset Account</span>
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filters Toolbar for Bank Cash Book */}
        {activeTab === 'treasury_ledger' && (
          <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Presets & Type Pills */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-600" /> Period:
                </span>
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'this_quarter', label: 'This Quarter' },
                  { id: 'this_year', label: 'This Year' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setDatePreset(btn.id as DatePreset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                      datePreset === btn.id
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-200 pl-3">
                <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-500" /> Type:
                </span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'MONEY_IN', label: 'Receipts' },
                  { id: 'MONEY_OUT', label: 'Payments' },
                  { id: 'TRANSFER', label: 'Transfers' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTypeFilter(item.id as any)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                      typeFilter === item.id
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Reset */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search party, doc ref, desc..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none w-52"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {(datePreset !== 'all' || typeFilter !== 'all' || searchQuery || selectedAccountId !== 'all') && (
                <button
                  onClick={() => {
                    setDatePreset('all');
                    setTypeFilter('all');
                    setSearchQuery('');
                    handleSelectAccount('all');
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'treasury_ledger' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Doc Ref</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Party / Detail</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Receipt (Dr)</th>
                  <th className="py-3 px-4 text-right">Payment (Cr)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {treasuryLedger.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.documentRef}
                    </td>
                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap font-medium">
                      {row.accountName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.type === 'Money In' || row.type === 'Opening Balance'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : row.type === 'Money Out'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : row.type === 'Direct Expense'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                      {row.party || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={row.description}>
                      {row.description}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                      {row.receipt > 0 ? formatOMR(row.receipt) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">
                      {row.payment > 0 ? formatOMR(row.payment) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(row.runningBalance)}
                    </td>
                  </tr>
                ))}
                {treasuryLedger.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400">
                      No treasury transactions found for the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
              {treasuryLedger.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-800">
                  <tr>
                    <td colSpan={6} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600">
                      Summary Totals &bull; Active View
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {ledgerTotals.totalReceipts > 0 ? formatOMR(ledgerTotals.totalReceipts) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                      {ledgerTotals.totalPayments > 0 ? formatOMR(ledgerTotals.totalPayments) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(ledgerTotals.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {activeTab === 'transfers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Doc Ref</th>
                  <th className="py-3 px-4">Transfer From</th>
                  <th className="py-3 px-4">Transfer To</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-center">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.transfers.map((tr, idx) => (
                  <tr key={`${tr.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{tr.date}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {tr.documentRef}
                    </td>
                    <td className="py-3 px-4 font-medium text-rose-700 whitespace-nowrap">
                      {tr.transferFromName} ({tr.transferFromType.replace('_', ' ')})
                    </td>
                    <td className="py-3 px-4 font-medium text-emerald-700 whitespace-nowrap">
                      {tr.transferToName} ({tr.transferToType.replace('_', ' ')})
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(tr.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{tr.remarks || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      {tr.attachmentUrl ? (
                        <a
                          href={tr.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Slip
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {state.transfers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No internal transfers recorded.
                    </td>
                  </tr>
                )}
              </tbody>
              {state.transfers.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-800">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600">
                      Total Internal Transfers
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(state.transfers.reduce((sum, tr) => sum + (tr.amount || 0), 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankingView;
