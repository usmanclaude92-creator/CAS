import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  Plus,
  FileSpreadsheet,
  ArrowRightLeft,
  Layers,
  Edit2,
  SlidersHorizontal,
  Search,
  X,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import { NewExpenseCategoryModal } from '../modals/NewExpenseCategoryModal';
import { AddExpenseCategoryModal } from '../modals/AddExpenseCategoryModal';
import { ManageExpenseCategoriesModal } from '../modals/ManageExpenseCategoriesModal';
import { ExpenseHead } from '../../types';

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
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedExpenseHeadId, setSelectedExpenseHeadId] = useState<string>('all');
  const [selectedPaidFrom, setSelectedPaidFrom] = useState<string>('all');

  // Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseHead | null>(null);
  const [, setVersion] = useState(0);

  // Subscribe to accounting engine updates (for new expenses, new categories, status changes)
  useEffect(() => {
    const unsubscribe = accountingService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const state = accountingService.getState();

  // Multi-criteria filtered direct expenses list
  const filteredExpenses = useMemo(() => {
    return state.directExpenses.filter((exp) => {
      // Date range filter
      if (startDate && exp.expenseDate < startDate) return false;
      if (endDate && exp.expenseDate > endDate) return false;

      // Project filter
      if (selectedProjectId !== 'all' && exp.projectId !== selectedProjectId) return false;

      // Expense head filter
      if (selectedExpenseHeadId !== 'all' && exp.expenseHeadId !== selectedExpenseHeadId) return false;

      // Paid From filter
      if (selectedPaidFrom !== 'all' && exp.paidFrom !== selectedPaidFrom) return false;

      // Text search query across all descriptive and reference fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (exp.description || '').toLowerCase().includes(q);
        const matchDoc = (exp.documentRef || '').toLowerCase().includes(q);
        const matchProj = (exp.projectName || '').toLowerCase().includes(q);
        const matchProjCode = (exp.projectCode || '').toLowerCase().includes(q);
        const matchHead = (exp.expenseHeadName || '').toLowerCase().includes(q);
        const matchAccount = (exp.accountName || '').toLowerCase().includes(q);
        const matchRemarks = (exp.remarks || '').toLowerCase().includes(q);
        const matchPaidFrom = (exp.paidFrom || '').toLowerCase().includes(q);

        if (
          !matchDesc &&
          !matchDoc &&
          !matchProj &&
          !matchProjCode &&
          !matchHead &&
          !matchAccount &&
          !matchRemarks &&
          !matchPaidFrom
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    state.directExpenses,
    startDate,
    endDate,
    selectedProjectId,
    selectedExpenseHeadId,
    selectedPaidFrom,
    searchQuery,
  ]);

  const totalExpenseAmount = filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);

  const activeFiltersCount = [
    searchQuery.trim() !== '',
    startDate !== '',
    endDate !== '',
    selectedProjectId !== 'all',
    selectedExpenseHeadId !== 'all',
    selectedPaidFrom !== 'all',
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedProjectId('all');
    setSelectedExpenseHeadId('all');
    setSelectedPaidFrom('all');
  };

  // Group by Expense Head
  const headBreakdown = useMemo(() => {
    return state.expenseHeads.map((head) => {
      const expensesForHead = state.directExpenses.filter((e) => e.expenseHeadId === head.id);
      const total = expensesForHead.reduce((acc, e) => acc + e.amount, 0);
      return {
        ...head,
        count: expensesForHead.length,
        total,
      };
    });
  }, [state.expenseHeads, state.directExpenses]);

  const handleExportExpenses = () => {
    const data = filteredExpenses.map((exp) => ({
      'Expense Date': exp.expenseDate,
      'Doc Ref': exp.documentRef,
      'Project Code': exp.projectCode || '—',
      'Project Name': exp.projectName,
      'Expense Head': exp.expenseHeadName,
      Description: exp.description,
      'Paid From': exp.paidFrom.replace('_', ' ').toUpperCase(),
      'Payment Account': exp.accountName,
      'Amount (OMR)': exp.amount,
      Remarks: exp.remarks || '—',
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

  // Lookup helpers for active filter badges
  const activeProjectName =
    selectedProjectId !== 'all'
      ? state.projects.find((p) => p.id === selectedProjectId)?.name
      : null;

  const activeHeadName =
    selectedExpenseHeadId !== 'all'
      ? state.expenseHeads.find((h) => h.id === selectedExpenseHeadId)?.name
      : null;

  return (
    <div className="container-responsive space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Direct Project &amp; Site Expenses</h2>
        </div>
      </div>

      {/* Expense Head Breakdown Cards */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {headBreakdown.map((hb) => (
            <div
              key={hb.id}
              onClick={() => setSelectedExpenseHeadId(selectedExpenseHeadId === hb.id ? 'all' : hb.id)}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all relative group ${
                selectedExpenseHeadId === hb.id
                  ? 'border-rose-500 bg-rose-50/60 shadow-xs ring-1 ring-rose-400'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-[11px] text-slate-600 truncate block font-medium flex-1" title={hb.name}>
                  {hb.name}
                </span>
                <button
                  type="button"
                  title="Edit/Rename or Archive category"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsManageCategoriesModalOpen(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
              <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                {formatOMR(hb.total)}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-slate-400">{hb.count} Vouchers</span>
                {hb.category && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 truncate max-w-[70px]">
                    {hb.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expenses Table with Comprehensive Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header & Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Direct Expenses Log ({filteredExpenses.length} of {state.directExpenses.length} Records)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Filtered Total: <strong className="text-rose-700 font-mono font-bold">{formatOMR(totalExpenseAmount)}</strong>
              </p>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Clear Filters ({activeFiltersCount})
              </button>
            )}
          </div>

          {/* Search & Filter Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 mt-3">
            {/* 1. Keyword Search Input */}
            <div className="lg:col-span-4 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, doc ref, project, payee..."
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2. Date Range: Start Date */}
            <div className="lg:col-span-2 flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs text-slate-700 focus:outline-none bg-transparent cursor-pointer"
              />
              {startDate && (
                <button onClick={() => setStartDate('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 3. Date Range: End Date */}
            <div className="lg:col-span-2 flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs text-slate-700 focus:outline-none bg-transparent cursor-pointer"
              />
              {endDate && (
                <button onClick={() => setEndDate('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 4. Project Filter Dropdown */}
            <div className="lg:col-span-2">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer truncate"
              >
                <option value="all">-- All Projects --</option>
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Expense Head Dropdown */}
            <div className="lg:col-span-2">
              <select
                value={selectedExpenseHeadId}
                onChange={(e) => setSelectedExpenseHeadId(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer truncate"
              >
                <option value="all">-- All Expense Heads ({state.expenseHeads.length}) --</option>
                {Array.from(new Set(state.expenseHeads.map((h) => h.category || 'Direct Project Cost'))).map(
                  (groupName) => (
                    <optgroup key={groupName} label={groupName}>
                      {state.expenseHeads
                        .filter((h) => (h.category || 'Direct Project Cost') === groupName)
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                    </optgroup>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Filter Pills / Chips for active filters */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Active Filters:</span>

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md">
                  <span>Search: "{searchQuery}"</span>
                  <button onClick={() => setSearchQuery('')} className="hover:text-rose-900 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              {startDate && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md">
                  <span>From: {startDate}</span>
                  <button onClick={() => setStartDate('')} className="hover:text-slate-900 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              {endDate && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md">
                  <span>To: {endDate}</span>
                  <button onClick={() => setEndDate('')} className="hover:text-slate-900 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              {activeProjectName && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md">
                  <span>Project: {activeProjectName}</span>
                  <button onClick={() => setSelectedProjectId('all')} className="hover:text-blue-900 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              {activeHeadName && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                  <span>Head: {activeHeadName}</span>
                  <button onClick={() => setSelectedExpenseHeadId('all')} className="hover:text-amber-900 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              {selectedPaidFrom !== 'all' && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md">
                  <span>Paid From: {selectedPaidFrom.replace('_', ' ')}</span>
                  <button onClick={() => setSelectedPaidFrom('all')} className="hover:text-purple-900 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              <button
                onClick={handleResetFilters}
                className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold underline ml-1 cursor-pointer"
              >
                Reset all
              </button>
            </div>
          )}
        </div>

        {/* Expenses Data Table */}
        <div className="table-responsive-container">
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
              {filteredExpenses.map((exp, idx) => (
                <tr key={`${exp.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{exp.expenseDate}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {exp.documentRef}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button
                      onClick={() => onSelectProject(exp.projectId)}
                      className="text-slate-800 hover:text-blue-600 font-medium cursor-pointer hover:underline"
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
                        className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
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
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Coins className="w-7 h-7 text-slate-300" />
                      <span className="font-medium text-slate-600">
                        No direct expenses match your search or filter criteria.
                      </span>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="text-xs font-semibold text-rose-700 hover:underline cursor-pointer mt-1"
                        >
                          Reset filters to show all {state.directExpenses.length} expenses
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Categories Modal for viewing, renaming, and archiving */}
      {isManageCategoriesModalOpen && (
        <ManageExpenseCategoriesModal
          isOpen={isManageCategoriesModalOpen}
          onClose={() => setIsManageCategoriesModalOpen(false)}
          onOpenAddModal={() => {
            setIsManageCategoriesModalOpen(false);
            setIsAddCategoryModalOpen(true);
          }}
        />
      )}

      {/* Add Expense Category Modal with Supabase master list update */}
      {isAddCategoryModalOpen && (
        <AddExpenseCategoryModal
          isOpen={isAddCategoryModalOpen}
          onClose={() => setIsAddCategoryModalOpen(false)}
          onSuccess={(newCat) => {
            setSelectedExpenseHeadId(newCat.id);
            setVersion((v) => v + 1);
          }}
        />
      )}

      {/* Fallback New/Edit Expense Category Modal */}
      {isCategoryModalOpen && (
        <NewExpenseCategoryModal
          isOpen={isCategoryModalOpen}
          editCategory={editingCategory}
          onClose={() => {
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
          }}
          onSuccess={(newCat) => {
            setSelectedExpenseHeadId(newCat.id);
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
};

export default ExpensesView;
