import React, { useState, useEffect } from 'react';
import { X, Layers, AlertCircle, CheckCircle2, Cloud, Sparkles, Database } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { supabaseService } from '../../services/supabaseClient';
import { ExpenseHead } from '../../types';

export interface AddExpenseCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newCategory: ExpenseHead) => void;
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

const QUICK_PRESETS = [
  { name: 'Scaffolding & Formwork Rental', group: 'Equipment & Machinery', desc: 'Mobile staging towers, cup-lock scaffolding, and shuttering plates' },
  { name: 'Site Safety Gear & PPE Supplies', group: 'Health, Safety & Environment (HSE)', desc: 'Safety helmets, boots, harnesses, and fire safety equipment' },
  { name: 'Excavator & Generator Diesel Fuel', group: 'Direct Project Cost', desc: 'Fuel supplies for earthmoving heavy equipment and on-site generators' },
  { name: 'Concrete Cube Lab Quality Testing', group: 'Quality Control & Lab Testing', desc: 'Third-party 7-day and 28-day compressive strength laboratory testing' },
  { name: 'Municipality & ROP Road Clearances', group: 'Statutory, Municipality & Permits', desc: 'Road opening permits, municipality fees, and traffic diversion approvals' },
  { name: 'Subcontractor Daily Labor', group: 'Direct Labor', desc: 'Daily masonry, steel fixing, and plastering artisan charges' },
];

export const AddExpenseCategoryModal: React.FC<AddExpenseCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costGroup, setCostGroup] = useState('Direct Project Cost');
  const [customGroup, setCustomGroup] = useState('');
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const isSupabaseLive = supabaseService.isConfigured();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setCostGroup('Direct Project Cost');
      setCustomGroup('');
      setIsCustomGroup(false);
      setError('');
      setSyncStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: { name: string; group: string; desc: string }) => {
    setName(preset.name);
    setCostGroup(preset.group);
    setDescription(preset.desc);
    setIsCustomGroup(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSyncStatus(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Expense category name is required.');
      return;
    }

    const resolvedGroup = isCustomGroup ? customGroup.trim() : costGroup.trim();
    if (isCustomGroup && !resolvedGroup) {
      setError('Please specify the custom cost classification group.');
      return;
    }

    // Check duplicate in local master list
    const existingHeads = accountingService.getState().expenseHeads;
    const isDuplicate = existingHeads.some(
      (h) => h.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      setError(`An expense category named "${cleanName}" already exists.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await accountingService.createExpenseHead({
        name: cleanName,
        category: resolvedGroup,
        description: description.trim() || undefined,
        status: 'active',
        remarks: description.trim() || undefined,
      });

      setSyncStatus('Successfully saved to the database!');

      if (onSuccess) {
        onSuccess(created);
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create expense category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="add-expense-category-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-800 to-rose-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600/70 border border-rose-400/40 flex items-center justify-center shadow-inner">
              <Layers className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">Add Expense Category</h2>
              <p className="text-[11px] text-rose-100/90 mt-0.5">
                Create a new cost category and update the Supabase master list
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-add-category"
            onClick={onClose}
            className="text-rose-200 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-rose-600/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supabase Connectivity Banner */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>Target Destination:</span>
          </div>
          {isSupabaseLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[10px]">
              <Cloud className="w-3 h-3 text-emerald-600" />
              Supabase Connected (Live Sync Active)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-[10px]">
              Local Storage Mode (Dual-write ready)
            </span>
          )}
        </div>

        {/* Quick Industry Presets */}
        <div className="bg-rose-50/50 dark:bg-rose-950/20 px-6 py-2.5 border-b border-rose-100 dark:border-rose-900/40">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-800 dark:text-rose-300 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Quick Construction Presets:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="text-[10px] px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/60 text-slate-700 dark:text-slate-300 hover:border-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 transition-colors cursor-pointer text-left font-medium"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {syncStatus && (
            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Category Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Expense Category Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="input-expense-category-name"
              type="text"
              required
              placeholder="e.g. Scaffolding & Formwork Rental"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>

          {/* Cost Classification Group */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cost Classification Group <span className="text-rose-600">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomGroup(!isCustomGroup)}
                className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer"
              >
                {isCustomGroup ? 'Choose standard group' : '+ Custom cost group'}
              </button>
            </div>

            {isCustomGroup ? (
              <input
                id="input-custom-cost-group"
                type="text"
                required
                placeholder="e.g. Subcontractor Testing & Commissioning"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            ) : (
              <select
                id="select-cost-group"
                value={costGroup}
                onChange={(e) => setCostGroup(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                {COMMON_COST_GROUPS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Remarks
            </label>
            <textarea
              id="input-expense-category-desc"
              rows={3}
              placeholder="e.g. Direct site expenses for mobile scaffolding towers, cup-lock staging, and safety guardrails"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="btn-cancel-add-category"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-add-category"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-rose-700 hover:bg-rose-800 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving to Supabase...' : 'Add Expense Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AddExpenseCategoryModal;
