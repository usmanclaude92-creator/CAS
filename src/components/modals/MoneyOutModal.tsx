import React, { useState, useEffect } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { TreasuryAccountType } from '../../types';
import { formatOMR } from '../../utils/formatters';

interface MoneyOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProjectId?: string;
}

export const MoneyOutModal: React.FC<MoneyOutModalProps> = ({ isOpen, onClose, preselectedProjectId }) => {
  const state = accountingService.getState();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidTo, setPaidTo] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [projectId, setProjectId] = useState(preselectedProjectId || state.projects[0]?.id || '');
  const [paymentFor, setPaymentFor] = useState<'purchase' | 'expense' | 'other'>('purchase');
  const [purchaseId, setPurchaseId] = useState('');
  const [expenseHeadId, setExpenseHeadId] = useState(state.expenseHeads[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [paidFrom, setPaidFrom] = useState<TreasuryAccountType>('bank');
  const [accountId, setAccountId] = useState(state.bankAccounts[0]?.id || '');
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update default account when paidFrom changes
  useEffect(() => {
    if (paidFrom === 'bank') {
      setAccountId(state.bankAccounts[0]?.id || '');
    } else if (paidFrom === 'cash') {
      setAccountId(state.cashAccounts[0]?.id || '');
    } else if (paidFrom === 'petty_cash') {
      setAccountId(state.pettyCashAccounts[0]?.id || '');
    }
  }, [paidFrom, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  // Outstanding purchases for selected project & vendor
  const availablePurchases = state.purchases.filter((p) => {
    if (p.status === 'reversed') return false;
    if (p.outstandingAmount <= 0) return false;
    if (projectId && p.projectId !== projectId) return false;
    if (vendorId && p.vendorId !== vendorId) return false;
    return true;
  });

  const handlePurchaseChange = (purId: string) => {
    setPurchaseId(purId);
    const pur = state.purchases.find((p) => p.id === purId);
    if (pur) {
      setProjectId(pur.projectId);
      setVendorId(pur.vendorId);
      setPaidTo(pur.vendorName);
      setAmount(pur.outstandingAmount.toString());
      if (!documentRef) {
        setDocumentRef(`PV-${pur.purchaseInvoiceNumber}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!paidTo.trim()) {
      setError('Paid To is required.');
      return;
    }

    if (paymentFor === 'purchase') {
      if (!purchaseId) {
        setError('Please select a purchase invoice to settle.');
        return;
      }
    }

    if (!accountId) {
      setError(`Please select a valid paying ${paidFrom.replace('_', ' ')} account.`);
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (file) {
        const uploadRes = await uploadAttachmentFile(file, 'MONEY_OUT', documentRef || 'payment');
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
      }

      accountingService.recordMoneyOut({
        transactionDate: date,
        paidTo,
        vendorId: vendorId || undefined,
        projectId: projectId || undefined,
        paymentFor,
        purchaseId: paymentFor === 'purchase' ? purchaseId : undefined,
        expenseHeadId: paymentFor === 'expense' ? expenseHeadId : undefined,
        amount: numericAmount,
        paidFrom,
        accountId,
        documentRef: documentRef.trim() || `PV-${Date.now().toString().slice(-4)}`,
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record Money Out transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Record Money Out (Payment)</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Updates Bank/Cash balance, Vendor ledger, Purchase outstanding &amp; Treasury without double-counting.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
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
                Transaction Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment For <span className="text-rose-600">*</span>
              </label>
              <select
                value={paymentFor}
                onChange={(e) => setPaymentFor(e.target.value as 'purchase' | 'expense' | 'other')}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              >
                <option value="purchase">Vendor Purchase Settlement</option>
                <option value="expense">Direct Expense Head</option>
                <option value="other">Other Payment / Disbursal</option>
              </select>
            </div>
          </div>

          {/* Conditional Fields based on paymentFor */}
          {paymentFor === 'purchase' && (
            <div className="space-y-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vendor <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={vendorId}
                    onChange={(e) => {
                      setVendorId(e.target.value);
                      const v = state.vendors.find((item) => item.id === e.target.value);
                      if (v) setPaidTo(v.name);
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <option value="">-- Select Vendor --</option>
                    {state.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Project</label>
                  <select
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setPurchaseId('');
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <option value="">-- All Projects --</option>
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Purchase Invoice <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={purchaseId}
                  onChange={(e) => handlePurchaseChange(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">-- Select Outstanding Purchase --</option>
                  {availablePurchases.map((p, idx) => (
                    <option key={`${p.id}-${idx}`} value={p.id}>
                      Purchase #{p.purchaseInvoiceNumber} — Outstanding: {formatOMR(p.outstandingAmount)} ({p.projectName})
                    </option>
                  ))}
                </select>
                {availablePurchases.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No outstanding purchase invoices found for this selection.
                  </p>
                )}
              </div>
            </div>
          )}

          {paymentFor === 'expense' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Expense Head <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={expenseHeadId}
                  onChange={(e) => setExpenseHeadId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  {state.expenseHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">-- Overhead / Non-Project --</option>
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Paid To (Payee / Vendor) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Al Batinah Building Materials LLC / Supplier Name"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>

          {/* Amount & Source Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Paid From <span className="text-rose-600">*</span>
              </label>
              <select
                value={paidFrom}
                onChange={(e) => setPaidFrom(e.target.value as TreasuryAccountType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="bank">Bank Account</option>
                <option value="cash">Cash in Hand</option>
                <option value="petty_cash">Petty Cash</option>
              </select>
            </div>
          </div>

          {/* Account selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {paidFrom === 'bank'
                ? 'Select Bank Account *'
                : paidFrom === 'cash'
                ? 'Select Cash Account *'
                : 'Select Petty Cash Account *'}
            </label>
            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
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

          {/* Document Reference & Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Document Reference <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PV-001 / Payment Voucher / Cheque Ref"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Supporting Document / Attachment
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="money-out-file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="money-out-file"
                  className="w-full flex items-center justify-between text-xs px-3 py-2 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600"
                >
                  <span className="truncate">{file ? file.name : 'Choose payment voucher / receipt...'}</span>
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Part payment voucher for steel rebar invoice PUR-001"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 cursor-pointer shadow"
            >
              {isSubmitting ? 'Posting Payment...' : 'Post Money Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoneyOutModal;
