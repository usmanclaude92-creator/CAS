import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProjectId?: string;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  preselectedProjectId,
}) => {
  const state = accountingService.getState();

  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorId, setVendorId] = useState(state.vendors[0]?.id || '');
  const [projectId, setProjectId] = useState(preselectedProjectId || state.projects[0]?.id || '');
  const [purchaseCategory, setPurchaseCategory] = useState('Materials');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!purchaseInvoiceNumber.trim()) {
      setError('Purchase Invoice Number is required.');
      return;
    }

    if (!vendorId) {
      setError('Please select a vendor.');
      return;
    }

    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    if (!documentRef.trim()) {
      setError('Document Reference is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (file) {
        const uploadRes = await uploadAttachmentFile(file, 'PURCHASE', purchaseInvoiceNumber);
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
      }

      accountingService.createPurchase({
        purchaseInvoiceNumber: purchaseInvoiceNumber.trim(),
        date,
        vendorId,
        projectId,
        purchaseCategory,
        description: description.trim(),
        amount: numericAmount,
        documentRef: documentRef.trim(),
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-700 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Record Vendor Purchase (Bill)</h2>
            <p className="text-xs text-amber-100 mt-0.5">
              Increases Project Cost &amp; Vendor Payable. Bank/Cash is not touched until payment is recorded.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white transition-colors cursor-pointer p-1"
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
                Purchase Invoice Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PUR-001 / INV-8821"
                value={purchaseInvoiceNumber}
                onChange={(e) => {
                  setPurchaseInvoiceNumber(e.target.value);
                  if (!documentRef) setDocumentRef(e.target.value);
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Invoice Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Vendor & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Vendor <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Project <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                value={purchaseCategory}
                onChange={(e) => setPurchaseCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="Materials">Materials (Steel, Cement, Aggregate)</option>
                <option value="Subcontractor">Subcontractor Labor</option>
                <option value="Equipment">Equipment Rental / Crane</option>
                <option value="Safety & Consumables">Safety & Consumables</option>
                <option value="Other">Other</option>
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
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Items Summary
            </label>
            <input
              type="text"
              placeholder="e.g. High tensile steel rebar 16mm & 12mm - 6 Tons"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
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
                placeholder="e.g. PUR-001 / Vendor Bill Ref"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Supporting Document / Attachment
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="purchase-file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="purchase-file"
                  className="w-full flex items-center justify-between text-xs px-3 py-2 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600"
                >
                  <span className="truncate">{file ? file.name : 'Choose supplier invoice scan...'}</span>
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Batch inspection certificate and delivery note verified"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-700 hover:bg-amber-600 text-white transition-colors disabled:opacity-50 cursor-pointer shadow"
            >
              {isSubmitting ? 'Posting...' : 'Post Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseModal;
