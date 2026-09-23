import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { notificationCenter } from '../../services/notificationCenter';
import { formatOMR } from '../../utils/formatters';
import { NoteParty, NoteSourceType, NoteType, VatTreatment } from '../../types';
import { computeVatSplit, OMAN_STANDARD_VAT_RATE, VAT_TREATMENT_LABELS } from '../../utils/vat';

interface CreditDebitNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyType: NoteParty;
  sourceType: NoteSourceType;
  sourceId: string;
}

export const CreditDebitNoteModal: React.FC<CreditDebitNoteModalProps> = ({
  isOpen,
  onClose,
  partyType,
  sourceType,
  sourceId,
}) => {
  const state = accountingService.getState();
  const sourceInvoice = partyType === 'customer' ? state.clientInvoices.find((i) => i.id === sourceId) : undefined;
  const sourcePurchase = partyType === 'vendor' ? state.purchases.find((p) => p.id === sourceId) : undefined;

  const sourceNumber = sourceInvoice?.invoiceNumber || sourcePurchase?.purchaseInvoiceNumber || '';
  const partyName = sourceInvoice?.customerName || sourcePurchase?.vendorName || '';
  const sourceOutstanding = sourceInvoice?.outstandingAmount ?? sourcePurchase?.outstandingAmount ?? 0;
  const defaultVatTreatment: VatTreatment = sourceInvoice?.vatTreatment || sourcePurchase?.vatTreatment || 'out_of_scope';

  const [noteType, setNoteType] = useState<NoteType>('credit');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [vatTreatment, setVatTreatment] = useState<VatTreatment>(defaultVatTreatment);
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vat = computeVatSplit(parseFloat(netAmount) || 0, OMAN_STANDARD_VAT_RATE, vatTreatment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericNetAmount = parseFloat(netAmount);
    if (isNaN(numericNetAmount) || numericNetAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason for this note is required.');
      return;
    }
    if (noteType === 'credit' && vat.grossAmount > sourceOutstanding) {
      setError(
        `Credit note of ${formatOMR(vat.grossAmount)} exceeds the outstanding balance of ${formatOMR(sourceOutstanding)} on ${sourceNumber}.`
      );
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
        const uploadRes = await uploadAttachmentFile(file, `${noteType}-note`, documentRef.trim());
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
      }

      const note = await accountingService.createCreditDebitNote({
        noteType,
        partyType,
        sourceType,
        sourceId,
        date,
        reason: reason.trim(),
        netAmount: numericNetAmount,
        vatRate: OMAN_STANDARD_VAT_RATE,
        vatTreatment,
        documentRef: documentRef.trim(),
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      notificationCenter.recordSaved(
        noteType === 'credit' ? 'Credit Note' : 'Debit Note',
        note.noteNumber,
        `${noteType === 'credit' ? 'Reduced' : 'Increased'} ${sourceNumber} by ${formatOMR(vat.grossAmount)} (Net ${formatOMR(vat.netAmount)} + VAT ${formatOMR(vat.vatAmount)}).`
      );

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Tailwind's JIT scanner needs full, static class strings — not
  // template-literal interpolation — so the two accent themes are spelled
  // out here rather than built from a color-name variable.
  const theme =
    noteType === 'credit'
      ? {
          header: 'bg-rose-700 px-6 py-4 text-white flex items-center justify-between',
          subtitle: 'text-xs text-rose-100 mt-0.5',
          preview: 'bg-rose-50/60 border border-rose-200 rounded-lg px-3 py-2 text-xs flex flex-col justify-center',
          button: 'px-4 py-2 text-xs font-medium rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition-colors disabled:opacity-50 cursor-pointer shadow',
        }
      : {
          header: 'bg-emerald-700 px-6 py-4 text-white flex items-center justify-between',
          subtitle: 'text-xs text-emerald-100 mt-0.5',
          preview: 'bg-emerald-50/60 border border-emerald-200 rounded-lg px-3 py-2 text-xs flex flex-col justify-center',
          button: 'px-4 py-2 text-xs font-medium rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 cursor-pointer shadow',
        };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className={theme.header}>
          <div>
            <h2 className="text-base font-semibold tracking-wide">
              Raise {noteType === 'credit' ? 'Credit' : 'Debit'} Note
            </h2>
            <p className={theme.subtitle}>
              Against {partyType === 'customer' ? 'Invoice' : 'Purchase'} {sourceNumber} — {partyName}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors cursor-pointer p-1">
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

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-600 flex items-center justify-between">
            <span>
              Source: <span className="font-mono font-semibold text-slate-800">{sourceNumber}</span>
            </span>
            <span>
              Outstanding: <span className="font-mono font-semibold text-slate-800">{formatOMR(sourceOutstanding)}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Note Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as NoteType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="credit">Credit Note (reduces amount owed)</option>
                <option value="debit">Debit Note (increases amount owed)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Reason <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pricing correction, returned materials, quantity dispute"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                VAT Treatment <span className="text-rose-600">*</span>
              </label>
              <select
                value={vatTreatment}
                onChange={(e) => setVatTreatment(e.target.value as VatTreatment)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="standard">{VAT_TREATMENT_LABELS.standard}</option>
                <option value="zero_rated">{VAT_TREATMENT_LABELS.zero_rated}</option>
                <option value="exempt">{VAT_TREATMENT_LABELS.exempt}</option>
                <option value="out_of_scope">{VAT_TREATMENT_LABELS.out_of_scope}</option>
                {partyType === 'vendor' && (
                  <option value="reverse_charge">{VAT_TREATMENT_LABELS.reverse_charge}</option>
                )}
              </select>
            </div>
          </div>

          <div className={theme.preview}>
            <div className="flex items-center justify-between text-slate-600">
              <span>VAT ({vat.vatRate}%)</span>
              <span className="font-mono font-semibold text-slate-800">{formatOMR(vat.vatAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-700 font-semibold mt-0.5">
              <span>Total {noteType === 'credit' ? 'Deducted' : 'Added'}</span>
              <span className="font-mono">{formatOMR(vat.grossAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Document Reference <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CN-Ref / DN-Ref"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Supporting Document</label>
              <div className="relative">
                <input type="file" id="cdn-file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                <label
                  htmlFor="cdn-file"
                  className="w-full flex items-center justify-between text-xs px-3 py-2 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600"
                >
                  <span className="truncate">{file ? file.name : 'Choose document...'}</span>
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className={theme.button}>
              {isSubmitting ? 'Posting...' : `Post ${noteType === 'credit' ? 'Credit' : 'Debit'} Note`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreditDebitNoteModal;
