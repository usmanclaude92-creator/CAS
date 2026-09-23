import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { TreasuryAccountType } from '../../types';
import { formatOMR } from '../../utils/formatters';
import { notificationCenter } from '../../services/notificationCenter';
import { MasterDataSelect, MasterDataSelectOption } from '../common/MasterDataSelect';
import { NewBankAccountModal } from './NewBankAccountModal';
import { NewCashAccountModal } from './NewCashAccountModal';
import { NewBusinessPartnerModal } from './NewBusinessPartnerModal';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AddNewTarget = 'from-bank' | 'from-cash' | 'from-petty_cash' | 'from-partner'
  | 'to-bank' | 'to-cash' | 'to-petty_cash' | 'to-partner';

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
  const [addNewOpen, setAddNewOpen] = useState<AddNewTarget | null>(null);

  // Reset the account selection to the first available one only when the
  // account TYPE itself changes — not every time the underlying accounts
  // array re-renders (e.g. right after creating a new account inline via
  // "+ Add New ..."), which would otherwise stomp on that fresh selection.
  const prevTransferFromType = useRef(transferFromType);
  useEffect(() => {
    if (prevTransferFromType.current === transferFromType) return;
    prevTransferFromType.current = transferFromType;
    if (transferFromType === 'bank') setTransferFromId(state.bankAccounts[0]?.id || '');
    if (transferFromType === 'cash') setTransferFromId(state.cashAccounts[0]?.id || '');
    if (transferFromType === 'petty_cash') setTransferFromId(state.pettyCashAccounts[0]?.id || '');
    if (transferFromType === 'partner') setTransferFromId(state.businessPartners[0]?.id || '');
  }, [transferFromType, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts, state.businessPartners]);

  const prevTransferToType = useRef(transferToType);
  useEffect(() => {
    if (prevTransferToType.current === transferToType) return;
    prevTransferToType.current = transferToType;
    if (transferToType === 'bank') setTransferToId(state.bankAccounts[0]?.id || '');
    if (transferToType === 'cash') setTransferToId(state.cashAccounts[0]?.id || '');
    if (transferToType === 'petty_cash') setTransferToId(state.pettyCashAccounts[0]?.id || '');
    if (transferToType === 'partner') setTransferToId(state.businessPartners[0]?.id || '');
  }, [transferToType, state.bankAccounts, state.cashAccounts, state.pettyCashAccounts, state.businessPartners]);

  const accountOptionsFor = (type: TreasuryAccountType): MasterDataSelectOption[] => {
    if (type === 'bank') return state.bankAccounts.map((b) => ({ value: b.id, label: `${b.bankName} (${formatOMR(b.currentBalance)})` }));
    if (type === 'cash') return state.cashAccounts.map((c) => ({ value: c.id, label: `${c.accountName} (${formatOMR(c.currentBalance)})` }));
    if (type === 'petty_cash') return state.pettyCashAccounts.map((p) => ({ value: p.id, label: `${p.accountName} (${formatOMR(p.currentBalance)})` }));
    return state.businessPartners.map((p) => ({ value: p.id, label: `${p.name} (${formatOMR(p.currentBalance)})` }));
  };

  const addNewLabelFor = (type: TreasuryAccountType): string => {
    if (type === 'bank') return '+ Add New Bank Account';
    if (type === 'cash') return '+ Add New Cash in Hand Account';
    if (type === 'petty_cash') return '+ Add New Petty Cash Account';
    return '+ Add New Business Partner';
  };

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
              Move funds between Bank, Cash in Hand, Petty Cash &amp; Business Partners. Does NOT affect project revenue or expenses.
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
                  <option value="partner">Business Partner</option>
                </select>

                <MasterDataSelect
                  required
                  value={transferFromId}
                  onChange={setTransferFromId}
                  onAddNew={() => setAddNewOpen(`from-${transferFromType}` as AddNewTarget)}
                  addNewLabel={addNewLabelFor(transferFromType)}
                  options={accountOptionsFor(transferFromType)}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                />
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
                  <option value="partner">Business Partner</option>
                </select>

                <MasterDataSelect
                  required
                  value={transferToId}
                  onChange={setTransferToId}
                  onAddNew={() => setAddNewOpen(`to-${transferToType}` as AddNewTarget)}
                  addNewLabel={addNewLabelFor(transferToType)}
                  options={accountOptionsFor(transferToType)}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                />
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

      <NewBankAccountModal
        isOpen={addNewOpen === 'from-bank' || addNewOpen === 'to-bank'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(account) => {
          if (addNewOpen === 'from-bank') setTransferFromId(account.id);
          else setTransferToId(account.id);
          setAddNewOpen(null);
        }}
      />
      <NewCashAccountModal
        isOpen={
          addNewOpen === 'from-cash' || addNewOpen === 'from-petty_cash' ||
          addNewOpen === 'to-cash' || addNewOpen === 'to-petty_cash'
        }
        defaultType={addNewOpen === 'from-petty_cash' || addNewOpen === 'to-petty_cash' ? 'petty_cash' : 'cash'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(account) => {
          if (addNewOpen?.startsWith('from-')) setTransferFromId(account.id);
          else setTransferToId(account.id);
          setAddNewOpen(null);
        }}
      />
      <NewBusinessPartnerModal
        isOpen={addNewOpen === 'from-partner' || addNewOpen === 'to-partner'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(partner) => {
          if (addNewOpen === 'from-partner') setTransferFromId(partner.id);
          else setTransferToId(partner.id);
          setAddNewOpen(null);
        }}
      />
    </div>
  );
};

export default TransferModal;
