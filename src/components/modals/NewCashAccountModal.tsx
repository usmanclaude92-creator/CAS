import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Wallet, Coins } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { notificationCenter } from '../../services/notificationCenter';

export type CashAccountType = 'cash' | 'petty_cash';

interface NewCashAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: CashAccountType;
}

export const NewCashAccountModal: React.FC<NewCashAccountModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'cash',
}) => {
  const [accountType, setAccountType] = useState<CashAccountType>(defaultType);
  const [accountName, setAccountName] = useState('');
  const [custodian, setCustodian] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.000');
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAccountType(defaultType);
      setAccountName('');
      setCustodian('');
      setOpeningBalance('0.000');
      setOpeningDate(new Date().toISOString().split('T')[0]);
      setRemarks('');
      setStatus('active');
      setError('');
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      setError('Account name is required.');
      return;
    }

    const numBalance = parseFloat(openingBalance) || 0;
    if (numBalance < 0) {
      setError('Opening balance cannot be negative.');
      return;
    }

    // Combine custodian and remarks cleanly if custodian is provided
    let combinedRemarks = remarks.trim();
    if (custodian.trim()) {
      combinedRemarks = combinedRemarks
        ? `Custodian: ${custodian.trim()} | ${combinedRemarks}`
        : `Custodian: ${custodian.trim()}`;
    }

    try {
      if (accountType === 'cash') {
        await accountingService.createCashAccount({
          accountName: accountName.trim(),
          openingBalance: numBalance,
          openingDate,
          status,
          remarks: combinedRemarks || undefined,
        });

        notificationCenter.recordSaved(
          'Cash in Hand Master',
          accountName.trim(),
          `Registered with opening balance OMR ${numBalance.toFixed(3)}.`
        );
      } else {
        await accountingService.createPettyCashAccount({
          accountName: accountName.trim(),
          openingBalance: numBalance,
          openingDate,
          status,
          remarks: combinedRemarks || undefined,
        });

        notificationCenter.recordSaved(
          'Petty Cash Master',
          accountName.trim(),
          `Registered with opening balance OMR ${numBalance.toFixed(3)}.`
        );
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save cash account.');
    }
  };

  const isCashInHand = accountType === 'cash';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md my-8 overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-4 text-white flex items-center justify-between transition-colors ${
            isCashInHand ? 'bg-emerald-800 dark:bg-emerald-950' : 'bg-amber-800 dark:bg-amber-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              {isCashInHand ? <Wallet className="w-4 h-4 text-white" /> : <Coins className="w-4 h-4 text-white" />}
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {isCashInHand ? 'New Cash in Hand Account' : 'New Petty Cash Account'}
              </h2>
              <p className="text-xs text-white/80">
                {isCashInHand
                  ? 'Register office vault, safe, or central cash register'
                  : 'Register site imprest float or custodian petty cash'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white cursor-pointer rounded-lg p-1 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Account Classification <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setAccountType('cash')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  isCashInHand
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Cash in Hand</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType('petty_cash')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  !isCashInHand
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Pettycash Account</span>
              </button>
            </div>
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={
                isCashInHand
                  ? 'e.g. Head Office Central Cash Vault'
                  : 'e.g. Sohar Site Imprest Petty Cash Float'
              }
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Custodian / Responsible Person */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Custodian / Responsible Person
            </label>
            <input
              type="text"
              placeholder={
                isCashInHand
                  ? 'e.g. Chief Cashier / Finance Officer'
                  : 'e.g. Salim Al-Harthy (Site Resident Engineer)'
              }
              value={custodian}
              onChange={(e) => setCustodian(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Opening Balance and Opening Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Opening Balance (OMR)
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Opening Date
              </label>
              <input
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="active">Active (Operational for vouchers and transfers)</option>
              <option value="inactive">Inactive (Suspended)</option>
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks / Site Location
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Kept in fireproof safe at Head Office, 2nd floor, Room 204"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer shadow-xs ${
                isCashInHand
                  ? 'bg-emerald-700 hover:bg-emerald-600'
                  : 'bg-amber-700 hover:bg-amber-600'
              }`}
            >
              {isCashInHand ? 'Save Cash in Hand Account' : 'Save Petty Cash Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCashAccountModal;
