import React from 'react';
import {
  Plus,
  FileSpreadsheet,
  ArrowLeft,
  ArrowRightLeft,
  Mail,
  Phone,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { formatOMR } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportToExcel';
import { buildBusinessPartnerExportRows } from '../../utils/businessPartnerImportTemplate';

interface BusinessPartnersViewProps {
  selectedBusinessPartnerId?: string | null;
  onClearSelectedBusinessPartner: () => void;
  onSelectBusinessPartner: (id: string) => void;
  onOpenNewBusinessPartner: () => void;
  onOpenTransfer: () => void;
}

export const BusinessPartnersView: React.FC<BusinessPartnersViewProps> = ({
  selectedBusinessPartnerId,
  onClearSelectedBusinessPartner,
  onSelectBusinessPartner,
  onOpenNewBusinessPartner,
  onOpenTransfer,
}) => {
  const state = accountingService.getState();

  const selectedPartner = selectedBusinessPartnerId
    ? state.businessPartners.find((p) => p.id === selectedBusinessPartnerId)
    : null;

  const partnerLedger = selectedPartner
    ? accountingService.getTreasuryLedger('partner', selectedPartner.id)
    : [];

  const handleExportPartnerStatement = () => {
    if (!selectedPartner) return;

    const data = partnerLedger.map((row) => ({
      'Date': row.date,
      'Doc Ref': row.documentRef,
      'Type': row.type,
      'Party / Detail': row.party || '—',
      'Description': row.description,
      'Received (OMR)': row.inflow > 0 ? row.inflow : '',
      'Paid (OMR)': row.outflow > 0 ? row.outflow : '',
      'Running Balance (OMR)': row.runningBalance ?? 0,
    }));

    exportToExcel({
      filename: `Business_Partner_Statement_${selectedPartner.code}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Statement of Account',
      title: `BUSINESS PARTNER STATEMENT OF ACCOUNT — ${selectedPartner.name.toUpperCase()}`,
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  const handleExportAllPartners = () => {
    const data = buildBusinessPartnerExportRows(state.businessPartners);

    exportToExcel({
      filename: `Business_Partners_Master_Data_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Business Partners',
      title: 'BUSINESS PARTNER MASTER DATA',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  // If a single business partner is selected
  if (selectedPartner) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onClearSelectedBusinessPartner}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Business Partners
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenTransfer}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-700 hover:bg-indigo-600 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              + Internal Transfer
            </button>
            <button
              onClick={handleExportPartnerStatement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Statement (Excel)
            </button>
          </div>
        </div>

        {/* Business Partner Detail Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  {selectedPartner.code}
                </span>
                <span className="text-xs text-slate-500 font-medium">{selectedPartner.partnerType}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1.5">{selectedPartner.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                {selectedPartner.contactPerson && (
                  <span>Contact: <strong>{selectedPartner.contactPerson}</strong></span>
                )}
                {selectedPartner.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedPartner.phone}
                  </span>
                )}
                {selectedPartner.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selectedPartner.email}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 text-right">
              <span className="text-xs text-teal-700 font-medium uppercase tracking-wider">
                Current Balance
              </span>
              <div className="text-2xl font-bold font-mono text-teal-900 mt-1">
                {formatOMR(selectedPartner.currentBalance)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Opening Balance: {formatOMR(selectedPartner.openingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Business Partner Running Balance Ledger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Business Partner Statement of Account &amp; Running Balance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log of internal transfers to/from this business partner
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Doc Ref</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Party / Detail</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Received (Dr)</th>
                  <th className="py-3 px-4 text-right">Paid (Cr)</th>
                  <th className="py-3 px-4 text-right">Running Balance (OMR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partnerLedger.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.documentRef}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.type === 'Opening Balance'
                            ? 'bg-slate-100 text-slate-700'
                            : row.type === 'Transfer In'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {row.party || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={row.description}>
                      {row.description}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                      {row.inflow > 0 ? formatOMR(row.inflow) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">
                      {row.outflow > 0 ? formatOMR(row.outflow) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatOMR(row.runningBalance ?? 0)}
                    </td>
                  </tr>
                ))}
                {partnerLedger.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      No ledger entries recorded for this business partner.
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

  // Master Business Partners Directory
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Business Partners</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Directors, related/group companies, JV partners &amp; other non-trade fund-transfer parties
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportAllPartners}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export Business Partners Summary
          </button>
          <button
            onClick={onOpenNewBusinessPartner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-teal-700 hover:bg-teal-600 cursor-pointer shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            New Business Partner
          </button>
        </div>
      </div>

      {/* Business Partners Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Partner Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4 text-right">Opening Balance</th>
                <th className="py-3 px-4 text-right">Total Received</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Current Balance</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.businessPartners.map((p) => {
                const ledger = accountingService.getTreasuryLedger('partner', p.id);
                const totalReceived = ledger.reduce((acc, row) => acc + row.inflow, 0);
                const totalPaid = ledger.reduce((acc, row) => acc + row.outflow, 0);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">{p.code}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectBusinessPartner(p.id)}
                        className="font-semibold text-slate-900 hover:text-teal-600 text-left cursor-pointer"
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                        {p.partnerType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.phone || p.email ? (
                        <div className="text-[11px]">
                          <div>{p.contactPerson}</div>
                          <div className="text-slate-400">{p.phone || p.email}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatOMR(p.openingBalance)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {formatOMR(totalReceived)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-700">
                      {formatOMR(totalPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-teal-700">
                      {formatOMR(p.currentBalance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectBusinessPartner(p.id)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded text-teal-700 bg-teal-50 hover:bg-teal-100 cursor-pointer"
                      >
                        Statement
                      </button>
                    </td>
                  </tr>
                );
              })}
              {state.businessPartners.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    No business partners registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BusinessPartnersView;
