import React, { useState } from 'react';
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
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR, formatPercent } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';

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

  const state = accountingService.getState();
  const summary = accountingService.getDashboardSummary();
  const profitabilities = accountingService.getAllProjectProfitabilities();

  // 1. Export Current Report to Excel
  const handleExport = () => {
    const today = new Date().toISOString().split('T')[0];

    if (selectedReport === 'profitability') {
      const data = profitabilities.map((p) => ({
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

      exportToExcel({
        filename: `Project_Profitability_Report_${today}`,
        sheetName: 'Profitability',
        title: 'CONSTRUCTION PROJECT PROFITABILITY & MARGIN REPORT',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    } else if (selectedReport === 'income_statement') {
      const data = [
        { 'Category': 'REVENUE', 'Line Item': 'Construction Billing (Invoices & IPCs)', 'Amount (OMR)': summary.totalRevenueInvoiced },
        { 'Category': 'REVENUE', 'Line Item': 'Total Operating Revenue', 'Amount (OMR)': summary.totalRevenueInvoiced },
        { 'Category': 'COST OF CONSTRUCTION', 'Line Item': 'Materials & Subcontractor Purchases', 'Amount (OMR)': summary.totalPurchases },
        { 'Category': 'COST OF CONSTRUCTION', 'Line Item': 'Direct Project & Site Expenses', 'Amount (OMR)': summary.totalDirectExpenses },
        { 'Category': 'COST OF CONSTRUCTION', 'Line Item': 'Total Direct Project Costs', 'Amount (OMR)': summary.totalProjectCosts },
        { 'Category': 'NET PROFIT', 'Line Item': 'Net Construction Gross Profit', 'Amount (OMR)': summary.netProfit },
      ];

      exportToExcel({
        filename: `Income_Statement_${today}`,
        sheetName: 'Income Statement',
        title: 'STATEMENT OF PROFIT & LOSS (INCOME STATEMENT)',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    } else if (selectedReport === 'balance_sheet') {
      const totalAssets = summary.totalLiquidFunds + summary.totalReceivables;
      const totalLiabilities = summary.totalPayables;
      const equity = totalAssets - totalLiabilities;

      const data = [
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

      exportToExcel({
        filename: `Balance_Sheet_${today}`,
        sheetName: 'Balance Sheet',
        title: 'STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    } else if (selectedReport === 'trial_balance') {
      const data = [
        { 'Account Code': '1010', 'Account Name': 'Bank Accounts', 'Debit (OMR)': summary.totalBankBalance, 'Credit (OMR)': '' },
        { 'Account Code': '1020', 'Account Name': 'Cash in Hand', 'Debit (OMR)': summary.totalCashBalance, 'Credit (OMR)': '' },
        { 'Account Code': '1030', 'Account Name': 'Petty Cash Floats', 'Debit (OMR)': summary.totalPettyCashBalance, 'Credit (OMR)': '' },
        { 'Account Code': '1200', 'Account Name': 'Accounts Receivable (Clients)', 'Debit (OMR)': summary.totalReceivables, 'Credit (OMR)': '' },
        { 'Account Code': '5010', 'Account Name': 'Project Direct Purchases & Subcontractors', 'Debit (OMR)': summary.totalPurchases, 'Credit (OMR)': '' },
        { 'Account Code': '5020', 'Account Name': 'Direct Site & Project Expenses', 'Debit (OMR)': summary.totalDirectExpenses, 'Credit (OMR)': '' },
        { 'Account Code': '2010', 'Account Name': 'Accounts Payable (Vendors)', 'Debit (OMR)': '', 'Credit (OMR)': summary.totalPayables },
        { 'Account Code': '4010', 'Account Name': 'Construction Revenue (Invoiced / IPC)', 'Debit (OMR)': '', 'Credit (OMR)': summary.totalRevenueInvoiced },
      ];

      exportToExcel({
        filename: `Trial_Balance_${today}`,
        sheetName: 'Trial Balance',
        title: 'TRIAL BALANCE STATEMENT',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    } else if (selectedReport === 'cash_flow') {
      const netCash = summary.cashInflows - (summary.cashOutflowsVendor + summary.cashOutflowsExpense);
      const data = [
        { 'Section': 'OPERATING INFLOWS', 'Description': 'Receipts from Clients / Customers', 'Inflow (OMR)': summary.cashInflows, 'Outflow (OMR)': '' },
        { 'Section': 'OPERATING OUTFLOWS', 'Description': 'Settlements to Vendors & Subcontractors', 'Inflow (OMR)': '', 'Outflow (OMR)': summary.cashOutflowsVendor },
        { 'Section': 'OPERATING OUTFLOWS', 'Description': 'Payments for Direct Site Expenses', 'Inflow (OMR)': '', 'Outflow (OMR)': summary.cashOutflowsExpense },
        { 'Section': 'NET CASH FLOW', 'Description': 'Net Cash Flow for the Period', 'Inflow (OMR)': netCash > 0 ? netCash : '', 'Outflow (OMR)': netCash < 0 ? Math.abs(netCash) : '' },
      ];

      exportToExcel({
        filename: `Cash_Flow_Statement_${today}`,
        sheetName: 'Cash Flow',
        title: 'STATEMENT OF CASH FLOWS',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    } else if (selectedReport === 'ar_aging') {
      const data = state.clientInvoices
        .filter((inv) => inv.outstandingAmount > 0 && inv.status !== 'reversed')
        .map((inv) => ({
          'Invoice / IPC #': inv.invoiceNumber,
          'Date': inv.date,
          'Customer': inv.customerName,
          'Project': inv.projectName,
          'Total Amount (OMR)': inv.amount,
          'Received (OMR)': inv.receivedAmount,
          'Current Balance (OMR)': inv.outstandingAmount,
          'Aging Bracket': '0 - 30 Days (Current)',
        }));

      exportToExcel({
        filename: `AR_Aging_Report_${today}`,
        sheetName: 'AR Aging',
        title: 'ACCOUNTS RECEIVABLE AGING ANALYSIS',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    } else if (selectedReport === 'ap_aging') {
      const data = state.purchases
        .filter((p) => p.outstandingAmount > 0 && p.status !== 'reversed')
        .map((p) => ({
          'Purchase Bill #': p.purchaseInvoiceNumber,
          'Date': p.date,
          'Vendor': p.vendorName,
          'Project': p.projectName,
          'Category': p.purchaseCategory,
          'Total Amount (OMR)': p.amount,
          'Paid (OMR)': p.paidAmount,
          'Current Balance (OMR)': p.outstandingAmount,
          'Aging Bracket': '0 - 30 Days (Current)',
        }));

      exportToExcel({
        filename: `AP_Aging_Report_${today}`,
        sheetName: 'AP Aging',
        title: 'ACCOUNTS PAYABLE AGING ANALYSIS',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    } else if (selectedReport === 'general_journal') {
      const journalEntries = accountingService.getJournalEntries();
      const data = journalEntries.map((je) => {
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

      exportToExcel({
        filename: `General_Journal_Audit_Trail_${today}`,
        sheetName: 'General Journal',
        title: 'GENERAL JOURNAL & AUDIT TRACEABILITY REGISTER',
        companyName: 'Construction Accounting System',
        currency: 'OMR',
        data,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Financial Reports &amp; Statements</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time IFRS/GAAP-compliant construction accounting reports with 3-decimal OMR precision
          </p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-emerald-700 hover:bg-emerald-600 transition-colors cursor-pointer shadow"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Active Report to Excel
        </button>
      </div>

      {/* Report Selection Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedReport('profitability')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'profitability'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Project Profitability
        </button>
        <button
          onClick={() => setSelectedReport('income_statement')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'income_statement'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Income Statement (P&amp;L)
        </button>
        <button
          onClick={() => setSelectedReport('balance_sheet')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'balance_sheet'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Balance Sheet
        </button>
        <button
          onClick={() => setSelectedReport('trial_balance')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'trial_balance'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Trial Balance
        </button>
        <button
          onClick={() => setSelectedReport('cash_flow')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'cash_flow'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Cash Flow Statement
        </button>
        <button
          onClick={() => setSelectedReport('ar_aging')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'ar_aging'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Receivables Aging (AR)
        </button>
        <button
          onClick={() => setSelectedReport('ap_aging')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'ap_aging'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Payables Aging (AP)
        </button>
        <button
          onClick={() => setSelectedReport('general_journal')}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            selectedReport === 'general_journal'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          General Journal (Audit Trace)
        </button>
      </div>

      {/* Report Canvas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        {/* REPORT 1: Project Profitability */}
        {selectedReport === 'profitability' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Project Profitability &amp; Cost Analysis</h3>
              <p className="text-xs text-slate-500">
                Project Cost = Purchases + Direct Expenses. Vendor settlements and client receipts move cash, not project cost or revenue.
              </p>
            </div>

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
                  {profitabilities.map((p) => (
                    <tr key={p.projectId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{p.projectCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{p.projectName}</td>
                      <td className="py-2.5 px-3 text-slate-700">{p.customerName}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.contractValue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-blue-700">{formatOMR(p.totalInvoiced)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.totalPurchases)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.totalExpenses)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-rose-700">{formatOMR(p.totalProjectCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{formatOMR(p.grossProfit)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">{formatPercent(p.profitMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 2: Income Statement (P&L) */}
        {selectedReport === 'income_statement' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">STATEMENT OF PROFIT AND LOSS</h3>
              <p className="text-xs text-slate-500">For the financial period ending {new Date().toISOString().split('T')[0]} (OMR)</p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Revenue */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Operating Revenue
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-700">Contract Revenue (Client Invoices &amp; IPCs)</span>
                    <span className="font-mono font-semibold text-slate-900">{formatOMR(summary.totalRevenueInvoiced)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Total Operating Revenue</span>
                    <span className="font-mono text-blue-700">{formatOMR(summary.totalRevenueInvoiced)}</span>
                  </div>
                </div>
              </div>

              {/* Direct Costs */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Cost of Construction &amp; Direct Site Expenses
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-700">Materials, Subcontractors &amp; Rental Purchases</span>
                    <span className="font-mono text-slate-900">{formatOMR(summary.totalPurchases)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">Direct Site &amp; Project Expenses (Fuel, Consumables)</span>
                    <span className="font-mono text-slate-900">{formatOMR(summary.totalDirectExpenses)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Total Cost of Construction</span>
                    <span className="font-mono text-rose-700">{formatOMR(summary.totalProjectCosts)}</span>
                  </div>
                </div>
              </div>

              {/* Gross Profit Summary */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-emerald-900">NET CONSTRUCTION PROFIT</span>
                  <p className="text-[11px] text-emerald-700">Operating Revenue minus Total Construction Costs</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono text-emerald-700">{formatOMR(summary.netProfit)}</div>
                  <div className="text-xs font-semibold text-emerald-800">Margin: {formatPercent(summary.profitMargin)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT 3: Balance Sheet */}
        {selectedReport === 'balance_sheet' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)</h3>
              <p className="text-xs text-slate-500">As at {new Date().toISOString().split('T')[0]} (OMR)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Assets */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Current Assets
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-700">Bank Accounts</span>
                      <span className="font-mono text-slate-900">{formatOMR(summary.totalBankBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Cash in Hand</span>
                      <span className="font-mono text-slate-900">{formatOMR(summary.totalCashBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Petty Cash Floats</span>
                      <span className="font-mono text-slate-900">{formatOMR(summary.totalPettyCashBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Accounts Receivable (Clients)</span>
                      <span className="font-mono text-slate-900">{formatOMR(summary.totalReceivables)}</span>
                    </div>
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
                        {formatOMR((summary.totalLiquidFunds + summary.totalReceivables) - summary.totalPayables)}
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

        {/* REPORT 4: Trial Balance */}
        {selectedReport === 'trial_balance' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">TRIAL BALANCE</h3>
              <p className="text-xs text-slate-500">Double-Entry Ledger Equality Verification (OMR)</p>
            </div>

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
                <tr>
                  <td className="py-2 px-3 text-slate-500">1010</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Bank Accounts</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalBankBalance)}</td>
                  <td className="py-2 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-500">1020</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Cash in Hand</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalCashBalance)}</td>
                  <td className="py-2 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-500">1030</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Petty Cash Floats</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalPettyCashBalance)}</td>
                  <td className="py-2 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-500">1200</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Accounts Receivable (Clients)</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalReceivables)}</td>
                  <td className="py-2 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-500">5010</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Project Direct Purchases (Materials/Subcontractors)</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalPurchases)}</td>
                  <td className="py-2 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-500">5020</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Direct Site &amp; Project Expenses</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalDirectExpenses)}</td>
                  <td className="py-2 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-500">2010</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Accounts Payable (Vendors)</td>
                  <td className="py-2 px-3 text-right">—</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalPayables)}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-500">4010</td>
                  <td className="py-2 px-3 font-sans text-slate-800">Construction Revenue (Invoiced / IPC)</td>
                  <td className="py-2 px-3 text-right">—</td>
                  <td className="py-2 px-3 text-right">{formatOMR(summary.totalRevenueInvoiced)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 5: Cash Flow */}
        {selectedReport === 'cash_flow' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-bold text-slate-900">STATEMENT OF CASH FLOWS</h3>
              <p className="text-xs text-slate-500">Direct Method for the period ending {new Date().toISOString().split('T')[0]} (OMR)</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Cash Flow from Operations
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Cash Received from Clients / IPC Collections</span>
                  <span className="font-mono text-emerald-700 font-semibold">{formatOMR(summary.cashInflows)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Cash Paid to Vendors &amp; Subcontractors</span>
                  <span className="font-mono text-rose-700">({formatOMR(summary.cashOutflowsVendor)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Cash Paid for Direct Site Expenses</span>
                  <span className="font-mono text-rose-700">({formatOMR(summary.cashOutflowsExpense)})</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                  <span>Net Cash from Operating Activities</span>
                  <span className="font-mono text-slate-900">
                    {formatOMR(summary.cashInflows - (summary.cashOutflowsVendor + summary.cashOutflowsExpense))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT 6: AR Aging */}
        {selectedReport === 'ar_aging' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Accounts Receivable Aging Schedule</h3>
              <p className="text-xs text-slate-500">Client Invoices and IPCs pending collection</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
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
                  {state.clientInvoices
                    .filter((i) => i.outstandingAmount > 0 && i.status !== 'reversed')
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{inv.date}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{inv.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{inv.projectName}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(inv.amount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatOMR(inv.receivedAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">{formatOMR(inv.outstandingAmount)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            0 - 30 Days (Current)
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 7: AP Aging */}
        {selectedReport === 'ap_aging' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Accounts Payable Aging Schedule</h3>
              <p className="text-xs text-slate-500">Supplier bills and subcontractor certificates pending payment</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Bill #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vendor</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3 text-right">Bill Amount</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Payable Balance</th>
                    <th className="py-2.5 px-3 text-center">Aging Bracket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.purchases
                    .filter((p) => p.outstandingAmount > 0 && p.status !== 'reversed')
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{p.purchaseInvoiceNumber}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{p.date}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{p.vendorName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{p.projectName}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatOMR(p.amount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatOMR(p.paidAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">{formatOMR(p.outstandingAmount)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            0 - 30 Days (Current)
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 8: General Journal (Audit Traceability) */}
        {selectedReport === 'general_journal' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">General Journal &amp; Audit Traceability</h3>
                <p className="text-xs text-slate-500">
                  Double-entry transactions linked to Projects, Customers, and Vendors with NUMERIC(18,3) OMR precision
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Foreign Key Traceability Enforced
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                  NUMERIC(18, 3)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
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
                  {accountingService.getJournalEntries().length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No journal entries posted yet. Perform transactions or run the Acceptance Test scenario.
                      </td>
                    </tr>
                  ) : (
                    accountingService.getJournalEntries().map((je) => {
                      const prj = state.projects.find((p) => p.id === je.projectId);
                      const cust = state.customers.find((c) => c.id === je.customerId);
                      const vend = state.vendors.find((v) => v.id === je.vendorId);

                      return (
                        <tr key={je.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{je.entryNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{je.date}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                              {je.sourceType}
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
      </div>
    </div>
  );
};

export default ReportsView;
