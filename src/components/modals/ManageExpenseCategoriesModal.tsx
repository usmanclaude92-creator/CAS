import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  Search,
  Edit2,
  Archive,
  RotateCcw,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { ExpenseHead } from '../../types';

export interface ManageExpenseCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: () => void;
}

export const ManageExpenseCategoriesModal: React.FC<ManageExpenseCategoriesModalProps> = ({
  isOpen,
  onClose,
  onOpenAddModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [, setRerender] = useState(0);

  const state = accountingService.getState();

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setStatusFilter('all');
      setGroupFilter('all');
      setEditingId(null);
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  // Unique groups for filter
  const allGroups = useMemo(() => {
    const groups = new Set<string>();
    state.expenseHeads.forEach((h) => {
      if (h.category) groups.add(h.category);
    });
    return Array.from(groups);
  }, [state.expenseHeads]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return state.expenseHeads.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cat.category && cat.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? cat.status === 'active'
          : cat.status === 'inactive';

      const matchesGroup =
        groupFilter === 'all' ? true : (cat.category || 'Direct Project Cost') === groupFilter;

      return matchesSearch && matchesStatus && matchesGroup;
    });
  }, [state.expenseHeads, searchTerm, statusFilter, groupFilter]);

  if (!isOpen) return null;

  const handleStartEdit = (cat: ExpenseHead) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditGroup(cat.category || 'Direct Project Cost');
    setEditDescription(cat.description || '');
    setError('');
    setSuccessMessage('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditGroup('');
    setEditDescription('');
    setError('');
  };

  const handleSaveEdit = async (cat: ExpenseHead) => {
    const cleanName = editName.trim();
    if (!cleanName) {
      setError('Category name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const updated = await accountingService.updateExpenseHead(cat.id, {
        name: cleanName,
        category: editGroup.trim() || 'Direct Project Cost',
        description: editDescription.trim() || undefined,
        remarks: editDescription.trim() || undefined,
      });

      setSuccessMessage(`Successfully updated "${updated.name}"`);
      setEditingId(null);
      setRerender((v) => v + 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to update category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async (cat: ExpenseHead) => {
    const willArchive = cat.status === 'active';
    const confirmPrompt = willArchive
      ? `Archive category "${cat.name}"? It will be hidden from new expense vouchers while keeping existing records intact.`
      : `Unarchive category "${cat.name}"? It will become available again for expense vouchers.`;

    if (!window.confirm(confirmPrompt)) return;

    setError('');
    setSuccessMessage('');

    try {
      const newStatus = willArchive ? 'inactive' : 'active';
      await accountingService.updateExpenseHead(cat.id, {
        status: newStatus,
      });

      setSuccessMessage(
        willArchive ? `Archived "${cat.name}"` : `Unarchived "${cat.name}" (now active)`
      );
      setRerender((v) => v + 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (cat: ExpenseHead) => {
    const linkedCount = state.directExpenses.filter((e) => e.expenseHeadId === cat.id).length;
    if (linkedCount > 0) {
      setError(`Cannot delete "${cat.name}" because it has ${linkedCount} linked vouchers. Please archive it instead.`);
      return;
    }

    if (!window.confirm(`Permanently delete category "${cat.name}"?`)) return;

    try {
      await accountingService.deleteExpenseHead(cat.id);
      setSuccessMessage(`Deleted category "${cat.name}"`);
      setRerender((v) => v + 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete category.');
    }
  };

  return (
    <div
      id="manage-expense-categories-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-800 via-rose-900 to-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-700/60 border border-rose-500/30 flex items-center justify-center shadow-inner">
              <Layers className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">Manage Expense Categories</h2>
              <p className="text-xs text-rose-200/90 mt-0.5">
                View, rename, archive, or reorganize category types for expense vouchers &amp; job costing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-modal-add-category"
              onClick={() => {
                onOpenAddModal();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-rose-900 bg-white hover:bg-rose-50 cursor-pointer shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-rose-700" />
              <span>Add New Category</span>
            </button>
            <button
              type="button"
              id="btn-close-manage-categories"
              onClick={onClose}
              className="text-rose-200 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-rose-700/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications & Status Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="text-rose-500 hover:text-rose-700 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="search-expense-categories"
                type="text"
                placeholder="Search category name, group, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({state.expenseHeads.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
              >
                Active ({state.expenseHeads.filter((h) => h.status === 'active').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  statusFilter === 'archived'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
                }`}
              >
                Archived ({state.expenseHeads.filter((h) => h.status === 'inactive').length})
              </button>
            </div>

            {/* Cost Group Dropdown */}
            <select
              id="filter-cost-group"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Groups ({allGroups.length})</option>
              {allGroups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories Table */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {filteredCategories.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <Layers className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold">No expense categories match your criteria</p>
              <p className="text-xs mt-1">Try clearing your search term or status filter</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Cost Group</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-3 text-center">Vouchers</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCategories.map((cat) => {
                  const isEditing = editingId === cat.id;
                  const isArchived = cat.status === 'inactive';
                  const linkedVouchersCount = state.directExpenses.filter(
                    (e) => e.expenseHeadId === cat.id
                  ).length;

                  if (isEditing) {
                    return (
                      <tr
                        key={cat.id}
                        className="bg-rose-50/60 dark:bg-rose-950/40 border-l-4 border-rose-600"
                      >
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Category name"
                            className="w-full text-xs px-2.5 py-1.5 border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editGroup}
                            onChange={(e) => setEditGroup(e.target.value)}
                            placeholder="Cost Group"
                            className="w-full text-xs px-2.5 py-1.5 border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description"
                            className="w-full text-xs px-2.5 py-1.5 border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                          {linkedVouchersCount}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                            Editing
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(cat)}
                              disabled={isSaving}
                              className="px-2.5 py-1 rounded-lg text-white bg-rose-700 hover:bg-rose-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={cat.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                        isArchived ? 'opacity-65 bg-slate-50/50 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className={isArchived ? 'line-through text-slate-400' : ''}>
                            {cat.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {cat.category || 'Direct Project Cost'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {cat.description || '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                        {linkedVouchersCount}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isArchived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Rename / Edit Button */}
                          <button
                            type="button"
                            title="Rename or update category"
                            onClick={() => handleStartEdit(cat)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 dark:text-slate-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Rename</span>
                          </button>

                          {/* Archive / Unarchive Button */}
                          <button
                            type="button"
                            title={isArchived ? 'Restore to Active status' : 'Archive this category'}
                            onClick={() => handleToggleArchive(cat)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold ${
                              isArchived
                                ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                            }`}
                          >
                            {isArchived ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Unarchive</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archive</span>
                              </>
                            )}
                          </button>

                          {/* Delete Button (only if 0 linked records) */}
                          <button
                            type="button"
                            title={
                              linkedVouchersCount > 0
                                ? 'Cannot delete: Category has linked vouchers. Use Archive instead.'
                                : 'Delete unlinked category'
                            }
                            disabled={linkedVouchersCount > 0}
                            onClick={() => handleDelete(cat)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Total Categories: {state.expenseHeads.length}
            </span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">
              {state.expenseHeads.filter((h) => h.status === 'active').length} active in vouchers
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white dark:bg-slate-700 hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
export default ManageExpenseCategoriesModal;
