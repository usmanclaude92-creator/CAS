import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, addMoney } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import {
  DatePreset,
  getDateRangeFromPreset,
  isDateInRange,
} from '../../utils/reportFilters';

interface BankingViewProps {
  onOpenTransfer: () => void;
  onOpenNewBankAccount: () => void;
  onOpenMoneyIn: () => void;
  onOpenMoneyOut: () => void;
}

export const BankingView: React.FC<BankingViewProps> = ({
  onOpenTransfer,
  onOpenNewBankAccount,
  onOpenMoneyIn,
  onOpenMoneyOut,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'treasury_ledger' | 'transfers'>('treasury_ledger');

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

  const rawTreasuryLedger = accountingService.getTreasuryLedger(
    undefined,
    selectedAccountId === 'all' ? undefined : selectedAccountId
  );

  const treasuryLedger = useMemo(() => {
    return rawTreasuryLedger.filter((row) => {
      if (!isDateInRange(row.date, dateRange.startDate, dateRange.endDate)) return false;
      if (typeFilter !== 'all' && row.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = row.documentRef.toLowerCase().includes(q);
        const matchParty = (row.party || '').toLowerCase().includes(q);
        const matchDesc = row.description.toLowerCase().includes(q);
        const matchAcc = row.accountName.toLowerCase().includes(q);
        if (!matchRef && !matchParty && !matchDesc && !matchAcc) return false;
      }
      return true;
    });
  }, [rawTreasuryLedger, dateRange, typeFilter, searchQuery]);

  const ledgerTotals = useMemo(() => {
    const totalReceipts = treasuryLedger.reduce((sum, r) => addMoney(sum, r.receipt), 0);
    const totalPayments = treasuryLedger.reduce((sum, r) => addMoney(sum, r.payment), 0);
    return { totalReceipts, totalPayments, count: treasuryLedger.length };
  }, [treasuryLedger]);

  const handleExportBankBook = () => {
    const data = treasuryLedger.map((row) => ({
      'Date': row.date,
      'Doc Ref': row.documentRef,
      'Account Type': row.accountType.replace('_', ' ').toUpperCase(),
      'Account Name': row.accountName,
      'Type': row.type.replace('_', ' '),
      'Party / Description': row.party ? `${row.party} — ${row.description}` : row.description,
      'Receipt Debit (OMR)': row.receipt > 0 ? row.receipt : '',
      'Payment Credit (OMR)': row.payment > 0 ? row.payment : '',
      'Running Balance (OMR)': row.runningBalance,
    }));

    exportToExcel({
      filename: `Bank_Cash_Book_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Treasury Book',
      title: `COMPANY TREASURY & BANK CASH BOOK STATEMENT (${dateRange.label.toUpperCase()})`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
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
          <button
            onClick={handleExportBankBook}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export Bank Book
          </button>
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
                onClick={() => setSelectedAccountId(b.id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedAccountId === b.id
                    ? 'border-blue-500 bg-blue-50/50'
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
                onClick={() => setSelectedAccountId(c.id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedAccountId === c.id
                    ? 'border-emerald-500 bg-emerald-50/50'
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
                onClick={() => setSelectedAccountId(p.id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedAccountId === p.id
                    ? 'border-amber-500 bg-amber-50/50'
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
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Bank &amp; Cash Accounts --</option>
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
                    setSelectedAccountId('all');
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
                          row.type === 'MONEY_IN'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.type === 'MONEY_OUT'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {row.type.replace('_', ' ')}
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
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankingView;
