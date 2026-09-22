import React, { useState, useEffect } from 'react';
import { X, Layers, AlertCircle, CheckCircle2, Sparkles, Tag } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { ExpenseHead } from '../../types';

interface NewExpenseCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newCategory: ExpenseHead) => void;
  editCategory?: ExpenseHead | null;
}

const COMMON_COST_GROUPS = [
  'Direct Project Cost',
  'Direct Labor',
  'Equipment & Machinery',
  'Subcontracting',
  'Site Overheads',
  'Statutory, Municipality & Permits',
  'Health, Safety & Environment (HSE)',
  'Office & Administration',
  'Quality Control & Lab Testing',
  'Miscellaneous & General',
];

const PRESET_CATEGORIES = [
  { name: 'Crane & Heavy Machinery Hire', group: 'Equipment & Machinery' },
  { name: 'Site Safety Gear & PPE Supplies', group: 'Health, Safety & Environment (HSE)' },
  { name: 'Subcontractor Daily Labor', group: 'Direct Labor' },
  { name: 'Excavator & Generator Diesel Fuel', group: 'Direct Project Cost' },
  { name: 'Municipality & ROP Road Clearances', group: 'Statutory, Municipality & Permits' },
  { name: 'Concrete Cube Lab Quality Testing', group: 'Quality Control & Lab Testing' },
  { name: 'Scaffolding & Shuttering Rental', group: 'Equipment & Machinery' },
  { name: 'Site Water, Dewatering & Sewage', group: 'Site Overheads' },
  { name: 'Labor Camp Mess & Provisions', group: 'Site Overheads' },
  { name: 'Small Tools & Consumable Hardware', group: 'Direct Project Cost' },
];

export const NewExpenseCategoryModal: React.FC<NewExpenseCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editCategory,
}) => {
  const [name, setName] = useState('');
  const [groupCategory, setGroupCategory] = useState('Direct Project Cost');
  const [customGroup, setCustomGroup] = useState('');
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
      if (COMMON_COST_GROUPS.includes(editCategory.category || '')) {
        setGroupCategory(editCategory.category || 'Direct Project Cost');
        setIsCustomGroup(false);
        setCustomGroup('');
      } else {
        setIsCustomGroup(true);
        setCustomGroup(editCategory.category || '');
      }
      setDescription(editCategory.description || '');
      setStatus(editCategory.status);
      setRemarks(editCategory.remarks || '');
    } else {
      setName('');
      setGroupCategory('Direct Project Cost');
      setIsCustomGroup(false);
      setCustomGroup('');
      setDescription('');
      setStatus('active');
      setRemarks('');
    }
    setError('');
  }, [editCategory, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: { name: string; group: string }) => {
    setName(preset.name);
    setGroupCategory(preset.group);
    setIsCustomGroup(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Category name is required.');
      return;
    }

    const resolvedGroup = isCustomGroup ? customGroup.trim() : groupCategory.trim();
    if (isCustomGroup && !resolvedGroup) {
      setError('Please specify the custom cost group name.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editCategory) {
        const updated = await accountingService.updateExpenseHead(editCategory.id, {
          name: cleanName,
          category: resolvedGroup,
          description: description.trim() || undefined,
          status,
          remarks: remarks.trim() || undefined,
        });
        if (onSuccess) onSuccess(updated);
      } else {
        const created = await accountingService.createExpenseHead({
          name: cleanName,
          category: resolvedGroup,
          description: description.trim() || undefined,
          status,
          remarks: remarks.trim() || undefined,
        });
        if (onSuccess) onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save expense category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-700 to-rose-800 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/60 border border-rose-400/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-rose-100" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">
                {editCategory ? 'Edit Expense Category' : 'Create New Expense Category'}
              </h2>
              <p className="text-[11px] text-rose-100/90 mt-0.5">
                Define cost heads for site vouchers, equipment, labor, and direct job costing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-rose-200 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-rose-600/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Quick Chips (only when creating new) */}
        {!editCategory && (
          <div className="bg-rose-50/70 dark:bg-rose-950/30 px-6 py-3 border-b border-rose-100 dark:border-rose-900/40">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-800 dark:text-rose-300 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Quick Construction Presets (Click to autofill):</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {PRESET_CATEGORIES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="text-[10px] px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/60 text-slate-700 dark:text-slate-200 hover:border-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 transition-colors cursor-pointer text-left font-medium"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Expense Category Name <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. Scaffolding & Formwork Rental"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Grouping / Accounting Classification */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Accounting Cost Classification <span className="text-rose-600">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomGroup(!isCustomGroup)}
                className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer"
              >
                {isCustomGroup ? 'Choose from list' : '+ Enter custom group'}
              </button>
            </div>

            {isCustomGroup ? (
              <input
                type="text"
                required
                placeholder="e.g. Subcontractor Specialized Testing"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            ) : (
              <select
                value={groupCategory}
                onChange={(e) => setGroupCategory(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                {COMMON_COST_GROUPS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Direct site vouchers for mobile scaffolding towers and staging boards"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="active">Active (Visible in all vouchers)</option>
                <option value="inactive">Inactive (Hidden from new vouchers)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Internal Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. GL Cost Center 5040"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-rose-700 hover:bg-rose-800 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editCategory ? 'Update Category' : 'Save Expense Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
