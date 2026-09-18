import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { notificationCenter } from '../../services/notificationCenter';

interface NewBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewBankAccountModal: React.FC<NewBankAccountModalProps> = ({ isOpen, onClose }) => {
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [branch, setBranch] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.000');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setError('Bank name, account name, and account number are required.');
      return;
    }

    try {
      accountingService.createBankAccount({
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        iban: iban.trim() || undefined,
        branch: branch.trim() || undefined,
        currency: 'OMR',
        openingBalance: parseFloat(openingBalance) || 0,
        status: 'active',
      });

      notificationCenter.recordSaved(
        'Bank Account Master',
        `${bankName.trim()} - ${accountNumber.trim()}`,
        `Account added with opening balance OMR ${(parseFloat(openingBalance) || 0).toFixed(3)}.`
      );

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save bank account.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md my-8 overflow-hidden">
        <div className="bg-indigo-800 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">New Bank Account</h2>
            <p className="text-xs text-indigo-200">Register Omani commercial bank account</p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bank Name <span className="text-rose-600">*</span>
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select Omani Bank --</option>
              <option value="Bank Muscat">Bank Muscat</option>
              <option value="Bank Dhofar">Bank Dhofar</option>
              <option value="National Bank of Oman (NBO)">National Bank of Oman (NBO)</option>
              <option value="Sohar International">Sohar International</option>
              <option value="Oman Arab Bank (OAB)">Oman Arab Bank (OAB)</option>
              <option value="Ahli Bank">Ahli Bank</option>
              <option value="Bank Nizwa (Islamic)">Bank Nizwa (Islamic)</option>
              <option value="Alizz Islamic Bank">Alizz Islamic Bank</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Account Label / Purpose <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Main Operations Current A/C"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="0423-018293-001"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Opening Balance (OMR)
              </label>
              <input
                type="number"
                step="0.001"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">IBAN Number</label>
            <input
              type="text"
              placeholder="OM62BMUS0423018293001001"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Branch Name</label>
            <input
              type="text"
              placeholder="e.g. Al Khoudh Main Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-800 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow"
            >
              Save Bank Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewBankAccountModal;
