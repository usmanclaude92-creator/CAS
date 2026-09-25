import React, { useState } from 'react';
import {
  Plus,
  FileSpreadsheet,
  ArrowLeft,
  Mail,
  Phone,
  UploadCloud,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { authService } from '../../services/authService';
import { formatOMR } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import { buildCustomerExportRows } from '../../utils/customerImportTemplate';
import { ClientInvoiceImportModal } from '../modals/ClientInvoiceImportModal';

interface CustomersViewProps {
  selectedCustomerId?: string | null;
  onClearSelectedCustomer: () => void;
  onSelectCustomer: (id: string) => void;
  onOpenNewCustomer: () => void;
  onOpenClientInvoice: () => void;
  onOpenMoneyIn: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  selectedCustomerId,
  onClearSelectedCustomer,
  onSelectCustomer,
  onOpenNewCustomer,
  onOpenClientInvoice,
  onOpenMoneyIn,
}) => {
  const state = accountingService.getState();
  const [isInvoiceImportOpen, setIsInvoiceImportOpen] = useState(false);
  const canImportInvoices = authService.hasPermission('invoices.import');

  const selectedCustomer = selectedCustomerId
    ? state.customers.find((c) => c.id === selectedCustomerId)
    : null;

  const customerLedger = selectedCustomer
    ? accountingService.getCustomerLedger(selectedCustomer.id)
    : [];

  const currentBalance = customerLedger.length > 0
    ? customerLedger[customerLedger.length - 1].outstanding
    : selectedCustomer?.openingBalance || 0;

  const handleExportCustomerStatement = () => {
    if (!selectedCustomer) return;

    const data = customerLedger.map((row) => ({
      'Date': row.date,
      'Doc Ref': row.documentRef,
      'Type': row.type.replace('_', ' '),
      'Project': row.projectName || '—',
      'Description': row.description,
      'Invoice Debit (OMR)': row.invoiced > 0 ? row.invoiced : '',
      'Receipt Credit (OMR)': row.received > 0 ? row.received : '',
      'Outstanding Balance (OMR)': row.outstanding,
    }));

    exportToExcel({
      filename: `Customer_Statement_${selectedCustomer.code}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Statement of Account',
      title: `CUSTOMER STATEMENT OF ACCOUNT — ${selectedCustomer.name.toUpperCase()}`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  const handleExportAllCustomers = () => {
    // Same master-data column layout as the Customer import template (see
    // src/utils/customerImportTemplate.ts), so the export can be
    // re-uploaded as-is.
    const data = buildCustomerExportRows(state.customers);

    exportToExcel({
      filename: `Customers_Master_Data_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Customers',
      title: 'CUSTOMER & CLIENT MASTER DATA',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  // If a single customer is selected
  if (selectedCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onClearSelectedCustomer}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Customers
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenClientInvoice}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-700 hover:bg-blue-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Invoice / IPC
            </button>
            <button
              onClick={onOpenMoneyIn}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-700 hover:bg-emerald-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Record Receipt from Client
            </button>
            <button
              onClick={handleExportCustomerStatement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Statement (Excel)
            </button>
          </div>
        </div>

        {/* Customer Detail Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedCustomer.code}
                </span>
                <span className="text-xs text-slate-500 font-medium">Customer Master</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1.5">{selectedCustomer.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                {selectedCustomer.vatin && (
                  <span>VATIN: <strong className="font-mono">{selectedCustomer.vatin}</strong></span>
                )}
                {selectedCustomer.contactPerson && (
                  <span>Contact: <strong>{selectedCustomer.contactPerson}</strong></span>
                )}
                {selectedCustomer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedCustomer.phone}
                  </span>
                )}
                {selectedCustomer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selectedCustomer.email}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-right">
              <span className="text-xs text-blue-700 font-medium uppercase tracking-wider">
                Current Outstanding Receivable
              </span>
              <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
                {formatOMR(currentBalance)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Opening Balance: {formatOMR(selectedCustomer.openingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Running Balance Ledger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Customer Statement of Account &amp; Running Balance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log of invoices raised, payments received, and running outstanding due
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Doc Ref</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Invoice (Dr)</th>
                  <th className="py-3 px-4 text-right">Receipt (Cr)</th>
                  <th className="py-3 px-4 text-right">Outstanding (OMR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerLedger.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.documentRef}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.type === 'OPENING_BALANCE'
                            ? 'bg-slate-100 text-slate-700'
                            : row.type === 'CLIENT_INVOICE'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {row.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {row.projectName || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={row.description}>
                      {row.description}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-blue-700 whitespace-nowrap">
                      {row.invoiced > 0 ? formatOMR(row.invoiced) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                      {row.received > 0 ? formatOMR(row.received) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(row.outstanding)}
                    </td>
                  </tr>
                ))}
                {customerLedger.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      No ledger entries recorded for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Master Customer Directory
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Customers &amp; Accounts Receivable</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Client billing, Interim Payment Certificates (IPC), cash collections, and receivable aging
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Permission-gated: only rendered for users whose role holds 'invoices.import' */}
          {canImportInvoices && (
            <button
              onClick={() => setIsInvoiceImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Import Invoices
            </button>
          )}
          <button
            onClick={handleExportAllCustomers}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export Receivables Summary
          </button>
          <button
            onClick={onOpenNewCustomer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-800 hover:bg-blue-700 cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            New Customer
          </button>
        </div>
      </div>

      {isInvoiceImportOpen && (
        <ClientInvoiceImportModal
          isOpen={isInvoiceImportOpen}
          onClose={() => setIsInvoiceImportOpen(false)}
        />
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">VATIN</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4 text-right">Opening Balance</th>
                <th className="py-3 px-4 text-right">Total Invoiced</th>
                <th className="py-3 px-4 text-right">Total Received</th>
                <th className="py-3 px-4 text-right">Current Outstanding</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.customers.map((c) => {
                const ledger = accountingService.getCustomerLedger(c.id);
                const outstanding = ledger.length > 0 ? ledger[ledger.length - 1].outstanding : c.openingBalance;
                const totalInvoiced = ledger.reduce((acc, row) => acc + row.invoiced, 0);
                const totalReceived = ledger.reduce((acc, row) => acc + row.received, 0);

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">{c.code}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectCustomer(c.id)}
                        className="font-semibold text-slate-900 hover:text-blue-600 text-left cursor-pointer"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{c.vatin || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.phone || c.email ? (
                        <div className="text-[11px]">
                          <div>{c.contactPerson}</div>
                          <div className="text-slate-400">{c.phone || c.email}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatOMR(c.openingBalance)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                      {formatOMR(totalInvoiced)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {formatOMR(totalReceived)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                      {formatOMR(outstanding)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectCustomer(c.id)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                      >
                        Statement
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomersView;
