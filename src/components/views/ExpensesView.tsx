import React, { useState } from 'react';
import {
  Coins,
  Plus,
  FileSpreadsheet,
  ArrowRightLeft,
  DollarSign,
  FileText,
  Filter,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';

interface ExpensesViewProps {
  onOpenExpense: () => void;
  onOpenTransfer: () => void;
  onSelectProject: (id: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onOpenExpense,
  onOpenTransfer,
  onSelectProject,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedExpenseHeadId, setSelectedExpenseHeadId] = useState<string>('all');

  const state = accountingService.getState();

  const filteredExpenses = state.directExpenses.filter((exp) => {
    if (selectedProjectId !== 'all' && exp.projectId !== selectedProjectId) return false;
    if (selectedExpenseHeadId !== 'all' && exp.expenseHeadId !== selectedExpenseHeadId) return false;
    return true;
  });

  const totalExpenseAmount = filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);

  // Group by Expense Head
  const headBreakdown = state.expenseHeads.map((head) => {
    const expensesForHead = state.directExpenses.filter((e) => e.expenseHeadId === head.id);
    const total = expensesForHead.reduce((acc, e) => acc + e.amount, 0);
    return {
      ...head,
      count: expensesForHead.length,
      total,
    };
  });

  const handleExportExpenses = () => {
    const data = filteredExpenses.map((exp) => ({
      'Expense Date': exp.expenseDate,
      'Doc Ref': exp.documentRef,
      'Project Code': exp.projectCode,
      'Project Name': exp.projectName,
      'Expense Head': exp.expenseHeadName,
      'Description': exp.description,
      'Paid From': exp.paidFrom.replace('_', ' ').toUpperCase(),
      'Amount (OMR)': exp.amount,
      'Remarks': exp.remarks || '—',
    }));

    exportToExcel({
      filename: `Direct_Expenses_Register_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Expenses',
      title: 'DIRECT SITE & PROJECT EXPENSES REGISTER',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Direct Project &amp; Site Expenses</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational site vouchers paid via Petty Cash, Cash in Hand, or Bank without supplier bills
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenTransfer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-700 hover:bg-indigo-600 cursor-pointer shadow"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Replenish Petty Cash
          </button>
          <button
            onClick={onOpenExpense}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-rose-700 hover:bg-rose-600 cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            + Record Direct Expense
          </button>
          <button
            onClick={handleExportExpenses}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export Expense Sheet
          </button>
        </div>
      </div>

      {/* Expense Head Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {headBreakdown.map((hb) => (
          <div
            key={hb.id}
            onClick={() => setSelectedExpenseHeadId(selectedExpenseHeadId === hb.id ? 'all' : hb.id)}
            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
              selectedExpenseHeadId === hb.id
                ? 'border-rose-500 bg-rose-50/60 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span className="text-[11px] text-slate-500 truncate block font-medium">
              {hb.name}
            </span>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1">
              {formatOMR(hb.total)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{hb.count} Vouchers</span>
          </div>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Direct Expenses Log ({filteredExpenses.length} Records)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtered Total: <strong className="text-rose-700 font-mono">{formatOMR(totalExpenseAmount)}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Projects --</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>

            <select
              value={selectedExpenseHeadId}
              onChange={(e) => setSelectedExpenseHeadId(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Expense Heads --</option>
              {state.expenseHeads.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Doc Ref</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Expense Head</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Paid From</th>
                <th className="py-3 px-4 text-right">Amount (OMR)</th>
                <th className="py-3 px-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{exp.expenseDate}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {exp.documentRef}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button
                      onClick={() => onSelectProject(exp.projectId)}
                      className="text-slate-800 hover:text-blue-600 font-medium cursor-pointer"
                    >
                      {exp.projectName}
                    </button>
                  </td>
                  <td className="py-3 px-4 font-medium text-rose-700 whitespace-nowrap">
                    {exp.expenseHeadName}
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={exp.description}>
                    {exp.description}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap capitalize text-slate-700">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                      {exp.paidFrom.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                    {formatOMR(exp.amount)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {exp.attachmentUrl ? (
                      <a
                        href={exp.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No direct expenses match the selected filters.
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

export default ExpensesView;
