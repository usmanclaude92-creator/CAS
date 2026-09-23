import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { TreasuryAccountType } from '../../types';
import { formatOMR } from '../../utils/formatters';
import { AddExpenseCategoryModal } from './AddExpenseCategoryModal';
import { notificationCenter } from '../../services/notificationCenter';
import { MasterDataSelect, MasterDataSelectGroup } from '../common/MasterDataSelect';
import { NewProjectModal } from './NewProjectModal';
import { NewBankAccountModal } from './NewBankAccountModal';
import { NewCashAccountModal } from './NewCashAccountModal';
import { VatTreatment } from '../../types';
import { computeVatSplit, OMAN_STANDARD_VAT_RATE, VAT_TREATMENT_LABELS } from '../../utils/vat';

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
  const [netAmount, setNetAmount] = useState('');
  const [vatTreatment, setVatTreatment] = useState<VatTreatment>('standard');
  const [paidFrom, setPaidFrom] = useState<TreasuryAccountType>('petty_cash');
  const [accountId, setAccountId] = useState(state.pettyCashAccounts[0]?.id || '');
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addNewOpen, setAddNewOpen] = useState<'project' | 'expense_head' | 'bank' | 'cash' | 'petty_cash' | null>(null);

  // Reset the account selection to the first available one only when the
  // account TYPE itself changes — not every time the underlying accounts
  // array re-renders (e.g. right after creating a new account inline via
  // "+ Add New ..."), which would otherwise stomp on that fresh selection.
  const prevPaidFrom = useRef(paidFrom);
  useEffect(() => {
    if (prevPaidFrom.current === paidFrom) return;
    prevPaidFrom.current = paidFrom;
    if (paidFrom === 'bank') {
      setAccountId(state.bankAccounts[0]?.id || '');
    } else if (paidFrom === 'cash') {
      setAccountId(state.cashAccounts[0]?.id || '');
    } else if (paidFrom === 'petty_cash') {
      setAccountId(state.pettyCashAccounts[0]?.id || '');
    }
  }, [paidFrom, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  const vat = computeVatSplit(parseFloat(netAmount) || 0, OMAN_STANDARD_VAT_RATE, vatTreatment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericNetAmount = parseFloat(netAmount);
    if (isNaN(numericNetAmount) || numericNetAmount <= 0) {
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

      await accountingService.createDirectExpense({
        expenseDate: date,
        projectId,
        expenseHeadId,
        description: description.trim(),
        netAmount: numericNetAmount,
        vatRate: OMAN_STANDARD_VAT_RATE,
        vatTreatment,
        paidFrom,
        accountId,
        documentRef: documentRef.trim() || `EXP-${Date.now().toString().slice(-4)}`,
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      notificationCenter.recordSaved(
        'Direct Expense Voucher',
        documentRef.trim() || 'Expense Voucher',
        `Disbursement of ${formatOMR(vat.grossAmount)} (Net ${formatOMR(vat.netAmount)} + VAT ${formatOMR(vat.vatAmount)}) posted against project cost.`
      );

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
              <MasterDataSelect
                required
                value={projectId}
                onChange={setProjectId}
                onAddNew={() => setAddNewOpen('project')}
                addNewLabel="+ Add New Project"
                placeholder="-- Select Project --"
                options={state.projects.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expense Category / Head <span className="text-rose-600">*</span>
              </label>
              <MasterDataSelect
                required
                value={expenseHeadId}
                onChange={setExpenseHeadId}
                onAddNew={() => setAddNewOpen('expense_head')}
                addNewLabel="+ Add New Expense Head"
                groups={
                  Array.from(new Set(state.expenseHeads.map((h) => h.category || 'Direct Project Cost'))).map(
                    (groupName): MasterDataSelectGroup => ({
                      label: groupName,
                      options: state.expenseHeads
                        .filter((h) => (h.category || 'Direct Project Cost') === groupName && (h.status === 'active' || h.id === expenseHeadId))
                        .map((h) => ({ value: h.id, label: `${h.name} ${h.status === 'inactive' ? '(Inactive)' : ''}` })),
                    })
                  )
                }
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount (OMR) — Excl. VAT <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                placeholder="0.000"
                value={netAmount}
                onChange={(e) => setNetAmount(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* VAT Treatment & computed breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                VAT Treatment <span className="text-rose-600">*</span>
              </label>
              <select
                value={vatTreatment}
                onChange={(e) => setVatTreatment(e.target.value as VatTreatment)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="standard">{VAT_TREATMENT_LABELS.standard}</option>
                <option value="zero_rated">{VAT_TREATMENT_LABELS.zero_rated}</option>
                <option value="exempt">{VAT_TREATMENT_LABELS.exempt}</option>
                <option value="out_of_scope">{VAT_TREATMENT_LABELS.out_of_scope}</option>
                <option value="reverse_charge">{VAT_TREATMENT_LABELS.reverse_charge}</option>
              </select>
            </div>
            <div className="bg-rose-50/60 border border-rose-200 rounded-lg px-3 py-2 text-xs flex flex-col justify-center">
              <div className="flex items-center justify-between text-slate-600">
                <span>VAT ({vat.vatRate}%){vatTreatment === 'reverse_charge' ? ' — self-accounted' : ''}</span>
                <span className="font-mono font-semibold text-slate-800">{formatOMR(vat.vatAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-semibold mt-0.5">
                <span>Total Paid</span>
                <span className="font-mono">{formatOMR(vat.grossAmount)}</span>
              </div>
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
              <MasterDataSelect
                required
                value={accountId}
                onChange={setAccountId}
                onAddNew={() => setAddNewOpen(paidFrom === 'bank' ? 'bank' : paidFrom === 'cash' ? 'cash' : 'petty_cash')}
                addNewLabel={
                  paidFrom === 'bank'
                    ? '+ Add New Bank Account'
                    : paidFrom === 'cash'
                    ? '+ Add New Cash in Hand Account'
                    : '+ Add New Petty Cash Account'
                }
                options={
                  paidFrom === 'bank'
                    ? state.bankAccounts.map((b) => ({ value: b.id, label: `${b.bankName} — ${b.accountName} (Balance: ${formatOMR(b.currentBalance)})` }))
                    : paidFrom === 'cash'
                    ? state.cashAccounts.map((c) => ({ value: c.id, label: `${c.accountName} (Balance: ${formatOMR(c.currentBalance)})` }))
                    : state.pettyCashAccounts.map((p) => ({ value: p.id, label: `${p.accountName} (Balance: ${formatOMR(p.currentBalance)})` }))
                }
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
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

      <NewProjectModal
        isOpen={addNewOpen === 'project'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(project) => {
          setProjectId(project.id);
          setAddNewOpen(null);
        }}
      />
      <AddExpenseCategoryModal
        isOpen={addNewOpen === 'expense_head'}
        onClose={() => setAddNewOpen(null)}
        onSuccess={(newCat) => {
          setExpenseHeadId(newCat.id);
          setAddNewOpen(null);
        }}
      />
      <NewBankAccountModal
        isOpen={addNewOpen === 'bank'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(account) => {
          setAccountId(account.id);
          setAddNewOpen(null);
        }}
      />
      <NewCashAccountModal
        isOpen={addNewOpen === 'cash' || addNewOpen === 'petty_cash'}
        defaultType={addNewOpen === 'petty_cash' ? 'petty_cash' : 'cash'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(account) => {
          setAccountId(account.id);
          setAddNewOpen(null);
        }}
      />
    </div>
  );
};

export default ExpenseModal;
