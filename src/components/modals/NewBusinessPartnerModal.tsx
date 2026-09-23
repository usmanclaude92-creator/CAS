import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { notificationCenter } from '../../services/notificationCenter';
import { BusinessPartnerType } from '../../types';

interface NewBusinessPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewBusinessPartnerModal: React.FC<NewBusinessPartnerModalProps> = ({ isOpen, onClose }) => {
  const [code, setCode] = useState(`BP-${Date.now().toString().slice(-4)}`);
  const [name, setName] = useState('');
  const [partnerType, setPartnerType] = useState<BusinessPartnerType>('Director/Shareholder');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.000');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Business partner name is required.');
      return;
    }

    try {
      await accountingService.createBusinessPartner({
        code: code.trim(),
        name: name.trim(),
        partnerType,
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        openingBalance: parseFloat(openingBalance) || 0,
        status: 'active',
        remarks: remarks.trim() || undefined,
      });

      notificationCenter.recordSaved(
        'Business Partner Master',
        name.trim(),
        `Business partner code ${code.trim()} registered with opening balance OMR ${(parseFloat(openingBalance) || 0).toFixed(3)}.`
      );

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save business partner.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden">
        <div className="bg-teal-800 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">New Business Partner Master</h2>
            <p className="text-xs text-teal-200">For fund transfers with directors, related companies & other non-trade parties</p>
          </div>
          <button onClick={onClose} className="text-teal-200 hover:text-white cursor-pointer">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Partner Code <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Partner Type</label>
              <select
                value={partnerType}
                onChange={(e) => setPartnerType(e.target.value as BusinessPartnerType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="Director/Shareholder">Director / Shareholder</option>
                <option value="Related/Group Company">Related / Group Company</option>
                <option value="Joint Venture Partner">Joint Venture Partner</option>
                <option value="Intercompany">Intercompany</option>
                <option value="Employee (Non-Payroll)">Employee (Non-Payroll)</option>
                <option value="Other">Other</option>
              </select>
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
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Business Partner Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ahmed Al Balushi (Director)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              placeholder="e.g. Al Khuwair, Muscat, Sultanate of Oman"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="Purpose of this account, e.g. director's current account"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-800 hover:bg-teal-700 text-white transition-colors cursor-pointer shadow"
            >
              Save Business Partner
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewBusinessPartnerModal;
