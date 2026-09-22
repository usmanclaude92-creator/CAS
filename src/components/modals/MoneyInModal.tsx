import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, Check } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { TreasuryAccountType } from '../../types';
import { formatOMR } from '../../utils/formatters';
import { notificationCenter } from '../../services/notificationCenter';

interface MoneyInModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProjectId?: string;
}

export const MoneyInModal: React.FC<MoneyInModalProps> = ({ isOpen, onClose, preselectedProjectId }) => {
  const state = accountingService.getState();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedFrom, setReceivedFrom] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState(preselectedProjectId || state.projects[0]?.id || '');
  const [against, setAgainst] = useState<'invoice' | 'other'>('invoice');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [receivedInto, setReceivedInto] = useState<TreasuryAccountType>('bank');
  const [accountId, setAccountId] = useState(state.bankAccounts[0]?.id || '');
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update default account when receivedInto changes
  useEffect(() => {
    if (receivedInto === 'bank') {
      setAccountId(state.bankAccounts[0]?.id || '');
    } else if (receivedInto === 'cash') {
      setAccountId(state.cashAccounts[0]?.id || '');
    } else if (receivedInto === 'petty_cash') {
      setAccountId(state.pettyCashAccounts[0]?.id || '');
    }
  }, [receivedInto, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  // Available invoices for selected project & customer
  const availableInvoices = state.clientInvoices.filter((inv) => {
    if (inv.status === 'reversed') return false;
    if (inv.outstandingAmount <= 0) return false;
    if (projectId && inv.projectId !== projectId) return false;
    if (customerId && inv.customerId !== customerId) return false;
    return true;
  });

  // When an invoice is selected, auto-fill customer, project, amount, receivedFrom
  const handleInvoiceChange = (invId: string) => {
    setInvoiceId(invId);
    const inv = state.clientInvoices.find((i) => i.id === invId);
    if (inv) {
      setProjectId(inv.projectId);
      setCustomerId(inv.customerId);
      setReceivedFrom(inv.customerName);
      setAmount(inv.outstandingAmount.toString());
      if (!documentRef) {
        setDocumentRef(`RCPT-${inv.invoiceNumber}`);
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

    if (!receivedFrom.trim()) {
      setError('Received From is required.');
      return;
    }

    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    if (against === 'invoice' && !invoiceId) {
      setError('Please select an Invoice / IPC to receive against.');
      return;
    }

    if (!accountId) {
      setError(`Please select a valid ${receivedInto.replace('_', ' ')} account.`);
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (file) {
        const uploadRes = await uploadAttachmentFile(file, 'MONEY_IN', documentRef || 'receipt');
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
      }

      await accountingService.recordMoneyIn({
        transactionDate: date,
        receivedFrom,
        customerId: customerId || undefined,
        projectId,
        against,
        invoiceId: against === 'invoice' ? invoiceId : undefined,
        amount: numericAmount,
        receivedInto,
        accountId,
        documentRef: documentRef.trim() || `BR-${Date.now().toString().slice(-4)}`,
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      notificationCenter.recordSaved(
        'Receipt Voucher (Money In)',
        documentRef.trim() || 'Receipt Voucher',
        `Receipt of ${formatOMR(numericAmount)} posted to treasury & receivables.`
      );

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record Money In transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-700 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Record Money In (Receipt)</h2>
            <p className="text-xs text-emerald-100 mt-0.5">
              Updates Bank/Cash balance, Customer ledger, Invoice outstanding &amp; Project cash flow in one step.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white transition-colors cursor-pointer p-1"
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
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Receipt Type (Against) <span className="text-rose-600">*</span>
              </label>
              <select
                value={against}
                onChange={(e) => setAgainst(e.target.value as 'invoice' | 'other')}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="invoice">Client Invoice / IPC</option>
                <option value="other">Other Receipt / Advance</option>
              </select>
            </div>
          </div>

          {/* Project & Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Project <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setInvoiceId('');
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">-- Select Project --</option>
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer {against === 'invoice' && <span className="text-rose-600">*</span>}
              </label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  const cust = state.customers.find((c) => c.id === e.target.value);
                  if (cust) setReceivedFrom(cust.name);
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">-- Select Customer --</option>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional Invoice / IPC Selection */}
          {against === 'invoice' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Client Invoice / IPC <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={invoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">-- Select Outstanding Invoice / IPC --</option>
                {availableInvoices.map((inv, idx) => (
                  <option key={`${inv.id}-${idx}`} value={inv.id}>
                    {inv.invoiceType} #{inv.invoiceNumber} — Outstanding: {formatOMR(inv.outstandingAmount)} (Total: {formatOMR(inv.amount)})
                  </option>
                ))}
              </select>
              {availableInvoices.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  No unpaid invoices found for the selected Project/Customer. You can record a new Client Invoice or select &quot;Other Receipt&quot;.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Received From <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Al Harthy Properties LLC / Client Name"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Amount & Destination Account */}
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
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Received Into <span className="text-rose-600">*</span>
              </label>
              <select
                value={receivedInto}
                onChange={(e) => setReceivedInto(e.target.value as TreasuryAccountType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="bank">Bank Account</option>
                <option value="cash">Cash in Hand</option>
                <option value="petty_cash">Petty Cash</option>
              </select>
            </div>
          </div>

          {/* Account selector based on receivedInto */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {receivedInto === 'bank'
                ? 'Select Bank Account *'
                : receivedInto === 'cash'
                ? 'Select Cash Account *'
                : 'Select Petty Cash Account *'}
            </label>
            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {receivedInto === 'bank' &&
                state.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} — {b.accountName} (Balance: {formatOMR(b.currentBalance)})
                  </option>
                ))}
              {receivedInto === 'cash' &&
                state.cashAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.accountName} (Balance: {formatOMR(c.currentBalance)})
                  </option>
                ))}
              {receivedInto === 'petty_cash' &&
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
                placeholder="e.g. BR-001 / Bank Ref / Wire Slip"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Supporting Document / Attachment
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="money-in-file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="money-in-file"
                  className="w-full flex items-center justify-between text-xs px-3 py-2 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600"
                >
                  <span className="truncate">{file ? file.name : 'Choose bank slip / advice...'}</span>
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. 50% advance settlement on IPC-001 via Wire Transfer"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 cursor-pointer shadow"
            >
              {isSubmitting ? 'Posting Receipt...' : 'Post Money In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoneyInModal;
