import React, { useState } from 'react';
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
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, formatPercent } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import { Transaction } from '../../types';
import { CashFlowProjectionCard } from '../dashboard/CashFlowProjectionCard';

interface DashboardViewProps {
  onOpenMoneyIn: () => void;
  onOpenMoneyOut: () => void;
  onOpenClientInvoice: () => void;
  onOpenPurchase: () => void;
  onOpenExpense: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onSelectVendor: (vendorId: string) => void;
  onReverseTransaction: (txn: Transaction) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenMoneyIn,
  onOpenMoneyOut,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onSelectProject,
  onSelectCustomer,
  onSelectVendor,
  onReverseTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const state = accountingService.getState();
  const summary = accountingService.getDashboardSummary();
  const profitabilities = accountingService.getAllProjectProfitabilities();

  // Filter transactions
  const allTransactions = accountingService.getAllTransactions();
  const filteredTransactions = allTransactions
    .filter((txn) => {
      if (filterType !== 'all' && txn.type !== filterType) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        txn.description.toLowerCase().includes(term) ||
        txn.documentRef.toLowerCase().includes(term) ||
        (txn.customerName && txn.customerName.toLowerCase().includes(term)) ||
        (txn.vendorName && txn.vendorName.toLowerCase().includes(term)) ||
        (txn.projectName && txn.projectName.toLowerCase().includes(term))
      );
    })
    .slice(0, 15);

  const handleExportProfitability = () => {
    const data = profitabilities.map((p) => ({
      'Project Code': p.projectCode,
      'Project Name': p.projectName,
      'Client': p.customerName,
      'Contract Value (OMR)': p.contractValue,
      'Invoiced Revenue (OMR)': p.totalInvoiced,
      'Cash Received (OMR)': p.totalReceived,
      'Client Outstanding (OMR)': p.outstandingReceivable,
      'Purchases (OMR)': p.totalPurchases,
      'Direct Expenses (OMR)': p.totalExpenses,
      'Total Project Cost (OMR)': p.totalProjectCost,
      'Gross Profit (OMR)': p.grossProfit,
      'Margin (%)': `${p.profitMargin.toFixed(2)}%`,
    }));

    exportToExcel({
      filename: `Project_Profitability_Summary_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Profitability',
      title: 'CONSTRUCTION PROJECT PROFITABILITY & MARGIN SUMMARY',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  return (
    <div className="space-y-6">
      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Treasury / Liquid Funds */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Liquid Funds (Treasury)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 tracking-tight font-mono">
            {formatOMR(summary.totalLiquidFunds)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>Bank: {formatOMR(summary.totalBankBalance)}</span>
            <span>Cash/Petty: {formatOMR(summary.totalCashBalance + summary.totalPettyCashBalance)}</span>
          </div>
        </div>

        {/* Client Receivables */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Client Receivables
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-blue-600 tracking-tight font-mono">
            {formatOMR(summary.totalReceivables)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>Total Invoiced: {formatOMR(summary.totalRevenueInvoiced)}</span>
            <span className="text-emerald-600 font-medium">Recvd: {formatOMR(summary.totalRevenueInvoiced - summary.totalReceivables)}</span>
          </div>
        </div>

        {/* Vendor Payables */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Vendor Payables
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600 tracking-tight font-mono">
            {formatOMR(summary.totalPayables)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>Purchases: {formatOMR(summary.totalPurchases)}</span>
            <span className="text-slate-600">Settled: {formatOMR(summary.totalPurchases - summary.totalPayables)}</span>
          </div>
        </div>

        {/* Net Profit & Margin */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Net Project Profit
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600 tracking-tight font-mono">
            {formatOMR(summary.netProfit)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>Costs: {formatOMR(summary.totalProjectCosts)}</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              Margin: {formatPercent(summary.profitMargin)}
            </span>
          </div>
        </div>
      </div>

      {/* Cash Flow Projection (Next 30, 60, 90 Days) Card */}
      <CashFlowProjectionCard
        state={state}
        currentLiquidBalance={summary.totalLiquidFunds}
      />

      {/* Project Profitability Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Project Financial Performance &amp; Profitability
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly enforces zero double-counting: Project Cost = Purchases + Direct Expenses (Vendor payments excluded)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportProfitability}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Excel
            </button>
            <button
              onClick={onOpenClientInvoice}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-700 hover:bg-blue-600 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Invoice / IPC
            </button>
            <button
              onClick={onOpenPurchase}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-amber-700 hover:bg-amber-600 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Purchase Bill
            </button>
            <button
              onClick={onOpenExpense}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-rose-700 hover:bg-rose-600 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Direct Expense
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Contract</th>
                <th className="py-3 px-4 text-right">Invoiced (Rev)</th>
                <th className="py-3 px-4 text-right">Received</th>
                <th className="py-3 px-4 text-right">Receivable</th>
                <th className="py-3 px-4 text-right">Purchases</th>
                <th className="py-3 px-4 text-right">Expenses</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4 text-right">Gross Profit</th>
                <th className="py-3 px-4 text-right">Margin</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profitabilities.map((p) => (
                <tr key={p.projectId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onSelectProject(p.projectId)}
                      className="text-slate-900 font-semibold hover:text-blue-600 text-left cursor-pointer flex items-center gap-1 group"
                    >
                      <span>{p.projectName}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <span className="text-[10px] font-mono text-slate-500 block">{p.projectCode}</span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => {
                        const proj = state.projects.find((pr) => pr.id === p.projectId);
                        if (proj) onSelectCustomer(proj.customerId);
                      }}
                      className="text-slate-700 hover:text-blue-600 text-left cursor-pointer"
                    >
                      {p.customerName}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatOMR(p.contractValue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                    {formatOMR(p.totalInvoiced)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {formatOMR(p.totalReceived)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700 font-medium">
                    {formatOMR(p.outstandingReceivable)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatOMR(p.totalPurchases)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatOMR(p.totalExpenses)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                    {formatOMR(p.totalProjectCost)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    {formatOMR(p.grossProfit)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {formatPercent(p.profitMargin)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onSelectProject(p.projectId)}
                      className="px-2 py-1 text-[11px] font-medium rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      Ledger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Multi-Ledger Transactions Stream */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Accounting Transactions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audit-compliant ledger postings with document attachments and reversal capabilities
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="MONEY_IN">Money In (Receipts)</option>
              <option value="MONEY_OUT">Money Out (Payments)</option>
              <option value="CLIENT_INVOICE">Client Invoices / IPC</option>
              <option value="PURCHASE">Vendor Purchases</option>
              <option value="EXPENSE">Direct Expenses</option>
              <option value="TRANSFER">Transfers</option>
            </select>

            <input
              type="text"
              placeholder="Search ref, desc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none w-36 sm:w-44"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
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
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((txn) => {
                const isReversed = txn.status === 'reversed';
                return (
                  <tr
                    key={txn.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isReversed ? 'bg-slate-50/50 opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {txn.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-medium text-slate-800">
                      {txn.documentRef}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          txn.type === 'MONEY_IN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : txn.type === 'MONEY_OUT'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : txn.type === 'CLIENT_INVOICE'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : txn.type === 'PURCHASE'
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : txn.type === 'EXPENSE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {txn.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                      {txn.projectName ? (
                        <button
                          onClick={() => txn.projectId && onSelectProject(txn.projectId)}
                          className="hover:text-blue-600 cursor-pointer"
                        >
                          {txn.projectName}
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-800">
                      {txn.customerName || txn.vendorName || txn.accountName || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={txn.description}>
                      {txn.description}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {formatOMR(txn.amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isReversed ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                          Reversed
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
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
                            className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                            title="View Supporting Attachment"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {!isReversed && (
                          <button
                            onClick={() => onReverseTransaction(txn)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Reverse Transaction (Prompt #29)"
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
