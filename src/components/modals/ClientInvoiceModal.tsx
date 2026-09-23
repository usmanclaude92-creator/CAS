import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { uploadAttachmentFile } from '../../services/supabaseClient';
import { notificationCenter } from '../../services/notificationCenter';
import { formatOMR } from '../../utils/formatters';
import { MasterDataSelect } from '../common/MasterDataSelect';
import { NewProjectModal } from './NewProjectModal';
import { NewCustomerModal } from './NewCustomerModal';
import { VatTreatment } from '../../types';
import { computeVatSplit, OMAN_STANDARD_VAT_RATE, VAT_TREATMENT_LABELS } from '../../utils/vat';

interface ClientInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProjectId?: string;
}

export const ClientInvoiceModal: React.FC<ClientInvoiceModalProps> = ({
  isOpen,
  onClose,
  preselectedProjectId,
}) => {
  const state = accountingService.getState();

  const [invoiceType, setInvoiceType] = useState<'IPC' | 'Invoice'>('IPC');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [projectId, setProjectId] = useState(preselectedProjectId || state.projects[0]?.id || '');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [vatTreatment, setVatTreatment] = useState<VatTreatment>('standard');
  const [documentRef, setDocumentRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addNewOpen, setAddNewOpen] = useState<'project' | 'customer' | null>(null);

  const vat = computeVatSplit(parseFloat(netAmount) || 0, OMAN_STANDARD_VAT_RATE, vatTreatment);

  // Auto-set customer when project changes
  const handleProjectChange = (pId: string) => {
    setProjectId(pId);
    const p = state.projects.find((proj) => proj.id === pId);
    if (p) {
      setCustomerId(p.customerId);
    }
  };

  // If initial project has customer, prefill
  React.useEffect(() => {
    if (projectId && !customerId) {
      const p = state.projects.find((proj) => proj.id === projectId);
      if (p) setCustomerId(p.customerId);
    }
  }, [projectId]);

  // Default VAT treatment from the customer's registration status: a
  // registered customer (has a VATIN) is presumed a standard-rated
  // domestic supply; an unregistered one defaults to out-of-scope. Either
  // way it's just a starting point — always user-editable.
  React.useEffect(() => {
    const customer = state.customers.find((c) => c.id === customerId);
    if (customer) {
      setVatTreatment(customer.vatin ? 'standard' : 'out_of_scope');
    }
  }, [customerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericNetAmount = parseFloat(netAmount);
    if (isNaN(numericNetAmount) || numericNetAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    if (!customerId) {
      setError('Please select a customer.');
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
        const uploadRes = await uploadAttachmentFile(file, invoiceType, documentRef.trim());
        attachmentUrl = uploadRes.url;
        attachmentName = uploadRes.name;
      }

      const invoice = await accountingService.createClientInvoice({
        invoiceType,
        date,
        customerId,
        projectId,
        description: description.trim(),
        netAmount: numericNetAmount,
        vatRate: OMAN_STANDARD_VAT_RATE,
        vatTreatment,
        documentRef: documentRef.trim(),
        attachmentUrl,
        attachmentName,
        remarks: remarks.trim() || undefined,
      });

      notificationCenter.recordSaved(
        invoiceType === 'IPC' ? 'Client Interim Certificate (IPC)' : 'Client Invoice',
        invoice.invoiceNumber,
        `Invoice of ${formatOMR(vat.grossAmount)} (Net ${formatOMR(vat.netAmount)} + VAT ${formatOMR(vat.vatAmount)}) committed to receivables.`
      );

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create client invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-700 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Raise Client Invoice / IPC</h2>
            <p className="text-xs text-blue-100 mt-0.5">
              Increases Customer Receivable and Project Revenue. Bank/Cash will not move until receipt is recorded.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors cursor-pointer p-1"
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
                Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as 'IPC' | 'Invoice')}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="IPC">Interim Payment Certificate (IPC)</option>
                <option value="Invoice">Standard Tax Invoice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{invoiceType} Number</label>
              <div className="w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-slate-500 italic">
                Assigned automatically on save (sequential Tax Invoice numbering)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* VAT Treatment & computed breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </select>
            </div>
            <div className="bg-blue-50/60 border border-blue-200 rounded-lg px-3 py-2 text-xs flex flex-col justify-center">
              <div className="flex items-center justify-between text-slate-600">
                <span>VAT ({vat.vatRate}%)</span>
                <span className="font-mono font-semibold text-slate-800">{formatOMR(vat.vatAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-semibold mt-0.5">
                <span>Total (Gross)</span>
                <span className="font-mono">{formatOMR(vat.grossAmount)}</span>
              </div>
            </div>
          </div>

          {/* Project & Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Project <span className="text-rose-600">*</span>
              </label>
              <MasterDataSelect
                required
                value={projectId}
                onChange={handleProjectChange}
                onAddNew={() => setAddNewOpen('project')}
                addNewLabel="+ Add New Project"
                placeholder="-- Select Project --"
                options={state.projects.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer <span className="text-rose-600">*</span>
              </label>
              <MasterDataSelect
                required
                value={customerId}
                onChange={setCustomerId}
                onAddNew={() => setAddNewOpen('customer')}
                addNewLabel="+ Add New Customer"
                placeholder="-- Select Customer --"
                options={state.customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Work Scope
            </label>
            <input
              type="text"
              placeholder="e.g. Interim Payment Certificate #1 - Foundation & Substructure Works"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                placeholder="e.g. IPC-001 / Cert-Ref"
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Supporting Document / Attachment
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="client-invoice-file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="client-invoice-file"
                  className="w-full flex items-center justify-between text-xs px-3 py-2 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-slate-600"
                >
                  <span className="truncate">{file ? file.name : 'Choose signed IPC / certificate...'}</span>
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Certified by Consultant Engineer"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 cursor-pointer shadow"
            >
              {isSubmitting ? 'Posting...' : 'Post Invoice / IPC'}
            </button>
          </div>
        </form>
      </div>

      <NewProjectModal
        isOpen={addNewOpen === 'project'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(project) => {
          handleProjectChange(project.id);
          setAddNewOpen(null);
        }}
      />
      <NewCustomerModal
        isOpen={addNewOpen === 'customer'}
        onClose={() => setAddNewOpen(null)}
        onCreated={(customer) => {
          setCustomerId(customer.id);
          setAddNewOpen(null);
        }}
      />
    </div>
  );
};

export default ClientInvoiceModal;
