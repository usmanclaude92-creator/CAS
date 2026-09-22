import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { Transaction } from '../../types';
import { formatOMR } from '../../utils/formatters';
import { notificationCenter } from '../../services/notificationCenter';

interface ReverseTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export const ReverseTransactionModal: React.FC<ReverseTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !transaction) return null;

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory reason is required to reverse an accounting transaction.');
      return;
    }

    setIsSubmitting(true);
    try {
      await accountingService.reverseTransaction(transaction.id, reason.trim());
      notificationCenter.recordReversed(transaction.documentRef, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reverse transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="bg-rose-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-200" />
            <h2 className="text-base font-semibold">Reverse Transaction</h2>
          </div>
          <button onClick={onClose} className="text-rose-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleReverse} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
            <strong>Accounting Warning:</strong> In compliance with financial audit standards, posted transactions are not deleted. A reversing journal entry will be posted, all associated ledgers, invoice/purchase balances, and bank balances will be restored, and an audit trail will be permanently recorded.
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction Ref:</span>
              <span className="font-mono font-medium text-slate-800">{transaction.documentRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type:</span>
              <span className="font-medium text-slate-800">{transaction.type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount:</span>
              <span className="font-semibold text-slate-900">{formatOMR(transaction.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Description:</span>
              <span className="text-slate-700 truncate max-w-[200px]">{transaction.description}</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-medium">{error}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mandatory Reason for Reversal <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Incorrect bank reference entered; duplicate voucher entered by site accountant..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow"
            >
              {isSubmitting ? 'Posting Reversal...' : 'Confirm Reversal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReverseTransactionModal;
