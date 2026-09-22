import React, { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, ArrowRight } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { TreasuryAccountType } from '../../types';
import { formatOMR } from '../../utils/formatters';
import { notificationCenter } from '../../services/notificationCenter';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose }) => {
  const state = accountingService.getState();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferFromType, setTransferFromType] = useState<TreasuryAccountType>('bank');
  const [transferFromId, setTransferFromId] = useState(state.bankAccounts[0]?.id || '');
  const [transferToType, setTransferToType] = useState<TreasuryAccountType>('petty_cash');
  const [transferToId, setTransferToId] = useState(state.pettyCashAccounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync account selection
  useEffect(() => {
    if (transferFromType === 'bank') setTransferFromId(state.bankAccounts[0]?.id || '');
    if (transferFromType === 'cash') setTransferFromId(state.cashAccounts[0]?.id || '');
    if (transferFromType === 'petty_cash') setTransferFromId(state.pettyCashAccounts[0]?.id || '');
  }, [transferFromType, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  useEffect(() => {
    if (transferToType === 'bank') setTransferToId(state.bankAccounts[0]?.id || '');
    if (transferToType === 'cash') setTransferToId(state.cashAccounts[0]?.id || '');
    if (transferToType === 'petty_cash') setTransferToId(state.pettyCashAccounts[0]?.id || '');
  }, [transferToType, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive transfer amount.');
      return;
    }

    if (transferFromType === transferToType && transferFromId === transferToId) {
      setError('Source and destination accounts cannot be identical.');
      return;
    }

    if (!documentRef.trim()) {
      setError('Document Reference is required for bank/cash transfer.');
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (file) {
        const uploadRes = await uploadAttachmentFile(file, 'TRANSFER', documentRef);
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
      }

      await accountingService.createTransfer({
        date,
        transferFromType,
        transferFromId,
        transferToType,
        transferToId,
        amount: numericAmount,
        documentRef: documentRef.trim(),
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      notificationCenter.recordSaved(
        'Treasury Fund Transfer',
        documentRef.trim() || 'Fund Transfer',
        `Internal transfer of ${formatOMR(numericAmount)} processed between treasury accounts.`
      );

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record internal transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Treasury Internal Transfer</h2>
            <p className="text-xs text-indigo-100 mt-0.5">
              Move funds between Bank, Cash in Hand &amp; Petty Cash. Does NOT affect project revenue or expenses.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white transition-colors cursor-pointer p-1"
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

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Transfer Date <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Transfer From & Transfer To Visual Block */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            {/* From */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Transfer From (Source Account)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={transferFromType}
                  onChange={(e) => setTransferFromType(e.target.value as TreasuryAccountType)}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="bank">Bank Account</option>
                  <option value="cash">Cash in Hand</option>
                  <option value="petty_cash">Petty Cash</option>
                </select>

                <select
                  required
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value)}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {transferFromType === 'bank' &&
                    state.bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({formatOMR(b.currentBalance)})
                      </option>
                    ))}
                  {transferFromType === 'cash' &&
                    state.cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.accountName} ({formatOMR(c.currentBalance)})
                      </option>
                    ))}
                  {transferFromType === 'petty_cash' &&
                    state.pettyCashAccounts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.accountName} ({formatOMR(p.currentBalance)})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* To */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Transfer To (Destination Account)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={transferToType}
                  onChange={(e) => setTransferToType(e.target.value as TreasuryAccountType)}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="petty_cash">Petty Cash</option>
                  <option value="cash">Cash in Hand</option>
                  <option value="bank">Bank Account</option>
                </select>

                <select
                  required
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value)}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {transferToType === 'bank' &&
                    state.bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({formatOMR(b.currentBalance)})
                      </option>
                    ))}
                  {transferToType === 'cash' &&
                    state.cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.accountName} ({formatOMR(c.currentBalance)})
                      </option>
                    ))}
                  {transferToType === 'petty_cash' &&
                    state.pettyCashAccounts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.accountName} ({formatOMR(p.currentBalance)})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

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
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Document Reference <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TRF-001 / Slip / Cheque No"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Supporting Transfer Voucher / Attachment
            </label>
            <div className="relative">
              <input
                type="file"
                id="transfer-file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="transfer-file"
                className="w-full flex items-center justify-between text-xs px-3 py-2 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600"
              >
                <span className="truncate">{file ? file.name : 'Choose bank transfer slip...'}</span>
                <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Bank Muscat to Site Petty Cash replenishment for weekly operational float"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 cursor-pointer shadow"
            >
              {isSubmitting ? 'Transferring...' : 'Execute Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferModal;
