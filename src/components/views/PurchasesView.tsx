import React, { useState } from 'react';
import {
  Truck,
  Plus,
  FileSpreadsheet,
  ArrowLeft,
  DollarSign,
  TrendingDown,
  Receipt,
  FileText,
  Mail,
  Phone,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';

interface PurchasesViewProps {
  selectedVendorId?: string | null;
  onClearSelectedVendor: () => void;
  onSelectVendor: (id: string) => void;
  onOpenNewVendor: () => void;
  onOpenPurchase: () => void;
  onOpenMoneyOut: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  selectedVendorId,
  onClearSelectedVendor,
  onSelectVendor,
  onOpenNewVendor,
  onOpenPurchase,
  onOpenMoneyOut,
}) => {
  const state = accountingService.getState();

  const selectedVendor = selectedVendorId
    ? state.vendors.find((v) => v.id === selectedVendorId)
    : null;

  const vendorLedger = selectedVendor
    ? accountingService.getVendorLedger(selectedVendor.id)
    : [];

  const currentPayable = vendorLedger.length > 0
    ? vendorLedger[vendorLedger.length - 1].outstanding
    : selectedVendor?.openingBalance || 0;

  const handleExportVendorStatement = () => {
    if (!selectedVendor) return;

    const data = vendorLedger.map((row) => ({
      'Date': row.date,
      'Doc Ref': row.documentRef,
      'Type': row.type.replace('_', ' '),
      'Project': row.projectName || '—',
      'Description': row.description,
      'Purchase Credit (OMR)': row.purchased > 0 ? row.purchased : '',
      'Payment Debit (OMR)': row.paid > 0 ? row.paid : '',
      'Payable Balance (OMR)': row.outstanding,
    }));

    exportToExcel({
      filename: `Vendor_Statement_${selectedVendor.code}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Vendor Statement',
      title: `VENDOR STATEMENT OF ACCOUNT — ${selectedVendor.name.toUpperCase()}`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  const handleExportAllVendors = () => {
    const data = state.vendors.map((v) => {
      const ledger = accountingService.getVendorLedger(v.id);
      const outstanding = ledger.length > 0 ? ledger[ledger.length - 1].outstanding : v.openingBalance;
      const totalPurchased = ledger.reduce((acc, row) => acc + row.purchased, 0);
      const totalPaid = ledger.reduce((acc, row) => acc + row.paid, 0);

      return {
        'Vendor Code': v.code,
        'Vendor Name': v.name,
        'Category': v.category,
        'Contact Person': v.contactPerson || '—',
        'Phone': v.phone || '—',
        'Opening Balance (OMR)': v.openingBalance,
        'Total Purchases (OMR)': totalPurchased,
        'Total Paid (OMR)': totalPaid,
        'Current Payable (OMR)': outstanding,
      };
    });

    exportToExcel({
      filename: `Vendors_Payables_Summary_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Payables',
      title: 'ACCOUNTS PAYABLE MASTER SUMMARY REPORT',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  // If a single vendor is selected
  if (selectedVendor) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onClearSelectedVendor}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Vendors &amp; Subcontractors
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenPurchase}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-amber-700 hover:bg-amber-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Record Purchase Bill
            </button>
            <button
              onClick={onOpenMoneyOut}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Settle Payment
            </button>
            <button
              onClick={handleExportVendorStatement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Statement (Excel)
            </button>
          </div>
        </div>

        {/* Vendor Detail Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {selectedVendor.code}
                </span>
                <span className="text-xs text-slate-500 font-medium">Category: {selectedVendor.category}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1.5">{selectedVendor.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                {selectedVendor.contactPerson && (
                  <span>Contact: <strong>{selectedVendor.contactPerson}</strong></span>
                )}
                {selectedVendor.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedVendor.phone}
                  </span>
                )}
                {selectedVendor.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selectedVendor.email}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-right">
              <span className="text-xs text-amber-700 font-medium uppercase tracking-wider">
                Current Payable to Vendor
              </span>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                {formatOMR(currentPayable)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Opening Balance: {formatOMR(selectedVendor.openingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Running Balance Ledger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Vendor Statement of Account &amp; Running Balance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log of supplier bills, payments made, and running payable balance
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
                  <th className="py-3 px-4 text-right">Bill Amount (Cr)</th>
                  <th className="py-3 px-4 text-right">Payment Paid (Dr)</th>
                  <th className="py-3 px-4 text-right">Payable Balance (OMR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorLedger.map((row) => (
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
                            : row.type === 'PURCHASE'
                            ? 'bg-amber-50 text-amber-700'
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
                    <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700 whitespace-nowrap">
                      {row.purchased > 0 ? formatOMR(row.purchased) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                      {row.paid > 0 ? formatOMR(row.paid) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(row.outstanding)}
                    </td>
                  </tr>
                ))}
                {vendorLedger.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      No ledger entries recorded for this vendor.
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

  // Master Vendor Directory
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Vendors, Suppliers &amp; Payables</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Material suppliers, subcontractor invoices, payment vouchers, and payables aging
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportAllVendors}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export Payables Summary
          </button>
          <button
            onClick={onOpenNewVendor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-amber-800 hover:bg-amber-700 cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            New Vendor
          </button>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4 text-right">Opening Balance</th>
                <th className="py-3 px-4 text-right">Total Purchases</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Current Payable</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.vendors.map((v) => {
                const ledger = accountingService.getVendorLedger(v.id);
                const outstanding = ledger.length > 0 ? ledger[ledger.length - 1].outstanding : v.openingBalance;
                const totalPurchased = ledger.reduce((acc, row) => acc + row.purchased, 0);
                const totalPaid = ledger.reduce((acc, row) => acc + row.paid, 0);

                return (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">{v.code}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectVendor(v.id)}
                        className="font-semibold text-slate-900 hover:text-amber-700 text-left cursor-pointer"
                      >
                        {v.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {v.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {v.phone || v.email ? (
                        <div className="text-[11px]">
                          <div>{v.contactPerson}</div>
                          <div className="text-slate-400">{v.phone || v.email}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatOMR(v.openingBalance)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                      {formatOMR(totalPurchased)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {formatOMR(totalPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                      {formatOMR(outstanding)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectVendor(v.id)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer"
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

export default PurchasesView;
