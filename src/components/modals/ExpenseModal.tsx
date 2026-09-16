import React, { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, Plus } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { TreasuryAccountType, ExpenseHead } from '../../types';
import { formatOMR } from '../../utils/formatters';
import { NewExpenseCategoryModal } from './NewExpenseCategoryModal';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProjectId?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  preselectedProjectId,
}) => {
  const state = accountingService.getState();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [projectId, setProjectId] = useState(preselectedProjectId || state.projects[0]?.id || '');
  const [expenseHeadId, setExpenseHeadId] = useState(state.expenseHeads[0]?.id || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidFrom, setPaidFrom] = useState<TreasuryAccountType>('petty_cash');
  const [accountId, setAccountId] = useState(state.pettyCashAccounts[0]?.id || '');
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    if (paidFrom === 'bank') {
      setAccountId(state.bankAccounts[0]?.id || '');
    } else if (paidFrom === 'cash') {
      setAccountId(state.cashAccounts[0]?.id || '');
    } else if (paidFrom === 'petty_cash') {
      setAccountId(state.pettyCashAccounts[0]?.id || '');
    }
  }, [paidFrom, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    if (!expenseHeadId) {
      setError('Please select an expense head.');
      return;
    }

    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    if (!accountId) {
      setError(`Please select a paying ${paidFrom.replace('_', ' ')} account.`);
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (file) {
        const uploadRes = await uploadAttachmentFile(file, 'EXPENSE', documentRef || 'receipt');
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
      }

      accountingService.createDirectExpense({
        expenseDate: date,
        projectId,
        expenseHeadId,
        description: description.trim(),
        amount: numericAmount,
        paidFrom,
        accountId,
        documentRef: documentRef.trim() || `EXP-${Date.now().toString().slice(-4)}`,
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record direct expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-rose-700 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Record Direct Expense</h2>
            <p className="text-xs text-rose-100 mt-0.5">
              Direct site or project costs without vendor bill. Deducts from Cash/Petty Cash/Bank and increases Project Cost.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-rose-200 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expense Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Project <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">-- Select Project --</option>
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  Expense Category / Head <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ New Category</span>
                </button>
              </div>
              <select
                required
                value={expenseHeadId}
                onChange={(e) => setExpenseHeadId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                {/* Group categories by classification */}
                {Array.from(new Set(state.expenseHeads.map((h) => h.category || 'Direct Project Cost'))).map((groupName) => (
                  <optgroup key={groupName} label={groupName}>
                    {state.expenseHeads
                      .filter((h) => (h.category || 'Direct Project Cost') === groupName && (h.status === 'active' || h.id === expenseHeadId))
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} {h.status === 'inactive' ? '(Inactive)' : ''}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount (OMR) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                placeholder="0.000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Diesel fuel for site 150kVA generator & excavator"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Paid From Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Paid From <span className="text-rose-600">*</span>
              </label>
              <select
                value={paidFrom}
                onChange={(e) => setPaidFrom(e.target.value as TreasuryAccountType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="petty_cash">Petty Cash</option>
                <option value="cash">Cash in Hand</option>
                <option value="bank">Bank Account</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {paidFrom === 'bank' &&
                  state.bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — {b.accountName} (Balance: {formatOMR(b.currentBalance)})
                    </option>
                  ))}
                {paidFrom === 'cash' &&
                  state.cashAccounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.accountName} (Balance: {formatOMR(c.currentBalance)})
                    </option>
                  ))}
                {paidFrom === 'petty_cash' &&
                  state.pettyCashAccounts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.accountName} (Balance: {formatOMR(p.currentBalance)})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Document Reference & Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Document Reference <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. EXP-001 / Receipt No / Slip Ref"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Supporting Receipt / Attachment
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="expense-file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="expense-file"
                  className="w-full flex items-center justify-between text-xs px-3 py-2 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600"
                >
                  <span className="truncate">{file ? file.name : 'Choose receipt photo / scan...'}</span>
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Shell Al Khoudh Station receipt #8841"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition-colors disabled:opacity-50 cursor-pointer shadow"
            >
              {isSubmitting ? 'Posting...' : 'Post Expense'}
            </button>
          </div>
        </form>
      </div>

      {/* Inline New Expense Category Modal */}
      {isCategoryModalOpen && (
        <NewExpenseCategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          onSuccess={(newCat) => {
            setExpenseHeadId(newCat.id);
            setIsCategoryModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default ExpenseModal;
