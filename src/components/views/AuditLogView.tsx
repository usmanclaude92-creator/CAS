import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  X,
  Eye,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { exportToExcel } from '../../utils/exportToExcel';
import { ArtifyLogo } from '../ArtifyLogo';
import { PrintPreviewModal, PrintPreviewColumn } from '../modals/PrintPreviewModal';
import { AuditLogEntry } from '../../types';

export const AuditLogView: React.FC = () => {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isPrintingSelectedOnly, setIsPrintingSelectedOnly] = useState<boolean>(false);
  const [printTimestamp, setPrintTimestamp] = useState<string>('');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [previewSelectedOnly, setPreviewSelectedOnly] = useState<boolean>(false);

  const state = accountingService.getState();

  const filteredLogs = state.auditLogs.filter((log) => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterEntity !== 'all' && log.entityType !== filterEntity) return false;
    return true;
  });

  // Get current timestamp formatted nicely for print header and footer
  const getFormattedTimestamp = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${dateStr} ${timeStr}`;
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrintingSelectedOnly(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredLogs.length > 0 && filteredLogs.every((log) => selectedLogIds.has(log.id));

  const handleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(filteredLogs.map((l) => l.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedLogIds(new Set());
  };

  const handlePrint = (selectedOnly: boolean = false) => {
    setPrintTimestamp(getFormattedTimestamp());
    setIsPrintingSelectedOnly(selectedOnly && selectedLogIds.size > 0);
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const handleOpenPrintPreview = (selectedOnly: boolean = false) => {
    setPrintTimestamp(getFormattedTimestamp());
    setPreviewSelectedOnly(selectedOnly && selectedLogIds.size > 0);
    setIsPrintPreviewOpen(true);
  };

  const handleConfirmPrintFromModal = () => {
    setIsPrintPreviewOpen(false);
    handlePrint(previewSelectedOnly);
  };

  const auditPreviewColumns: PrintPreviewColumn<AuditLogEntry>[] = [
    {
      header: 'Timestamp',
      accessor: (log) => log.timestamp.replace('T', ' ').substring(0, 19),
      isMono: true,
      width: 'w-36',
    },
    {
      header: 'User & Role',
      accessor: (log) => (
        <div>
          <span className="font-semibold text-slate-800">{log.userName}</span>
          <span className="text-[10px] text-slate-400 block capitalize">{log.userRole}</span>
        </div>
      ),
      width: 'w-36',
    },
    {
      header: 'Action',
      accessor: (log) => (
        <span
          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
            log.action === 'CREATE'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : log.action === 'REVERSE'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {log.action}
        </span>
      ),
      align: 'center',
      width: 'w-24',
    },
    {
      header: 'Entity Type',
      accessor: (log) => log.entityType,
      isMono: true,
      width: 'w-28',
    },
    {
      header: 'Entity ID',
      accessor: (log) => log.entityId,
      isMono: true,
      width: 'w-24',
    },
    {
      header: 'Reason / Notes',
      accessor: (log) => log.reason || '—',
    },
  ];

  const logsToDisplay =
    isPrintingSelectedOnly && selectedLogIds.size > 0
      ? filteredLogs.filter((log) => selectedLogIds.has(log.id))
      : filteredLogs;

  const logsForPreview =
    previewSelectedOnly && selectedLogIds.size > 0
      ? filteredLogs.filter((log) => selectedLogIds.has(log.id))
      : filteredLogs;

  const handleExportAudit = (selectedOnly: boolean = false) => {
    const targetLogs =
      selectedOnly && selectedLogIds.size > 0
        ? filteredLogs.filter((log) => selectedLogIds.has(log.id))
        : filteredLogs;

    const data = targetLogs.map((log) => ({
      'Timestamp': log.timestamp,
      'User Name': log.userName,
      'User Role': log.userRole,
      'Action': log.action,
      'Entity Type': log.entityType,
      'Entity ID': log.entityId,
      'Reason / Note': log.reason || '—',
      'Details': JSON.stringify(log.newValues || {}),
    }));

    exportToExcel({
      filename: `Audit_Log_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Audit Trail',
      title: selectedOnly ? 'SELECTED FINANCIAL SYSTEM AUDIT TRAIL' : 'FINANCIAL SYSTEM AUDIT TRAIL & LOGS',
      companyName: 'Al Tasneem & Partners Construction LLC - Muscat, Oman',
      currency: 'OMR',
      data,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-slate-900">System Audit Trail &amp; Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all financial events, approvals, reversals, and user activity
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedLogIds.size > 0 ? (
            <>
              <button
                type="button"
                onClick={() => handleOpenPrintPreview(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 cursor-pointer shadow-xs transition-colors"
                title="Preview print layout before printing selected records"
              >
                <Eye className="w-4 h-4 text-blue-600" />
                Print Preview ({selectedLogIds.size})
              </button>
              <button
                onClick={() => handlePrint(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
                title="Print selected audit transaction records as a single combined PDF"
              >
                <Printer className="w-4 h-4 text-blue-300" />
                Print Selected ({selectedLogIds.size}) as PDF
              </button>
              <button
                onClick={() => handleExportAudit(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export Selected ({selectedLogIds.size})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpenPrintPreview(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs transition-colors"
                title="Preview print layout before printing"
              >
                <Eye className="w-4 h-4 text-slate-600" />
                Print Preview
              </button>
              <button
                onClick={() => handlePrint(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-xs"
                title="Print all filtered audit logs as a combined PDF document"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                Print Audit PDF
              </button>
            </>
          )}

          <button
            onClick={() => handleExportAudit(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export All (Excel)
          </button>
        </div>
      </div>

      {/* Interactive Selection Banner */}
      {selectedLogIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-xs font-semibold text-blue-900">
              {selectedLogIds.size} of {filteredLogs.length} audit records selected for combined printing
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenPrintPreview(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-blue-300 text-blue-900 hover:bg-blue-100/60 cursor-pointer shadow-xs transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              Print Preview
            </button>
            <button
              onClick={() => handlePrint(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Selected Records as PDF
            </button>
            <button
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-100/50 cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" />
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Filter and Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Printable Official Statement Header - formatted for A4 PDF export */}
        <div className="hidden print:block print-header-container mb-6 p-4 border-b-2 border-slate-900">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <ArtifyLogo className="h-12 w-auto shrink-0" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
                  Financial System Audit Trail &amp; Transaction Ledger
                </h1>
                <p className="text-xs font-medium text-slate-600 mt-1">
                  Al Tasneem &amp; Partners Construction LLC &bull; Sultanate of Oman &bull; IFRS &amp; GAAP Governance
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-700 space-y-0.5 shrink-0 pl-4">
              <div>
                <span className="text-slate-500">Scope:</span>{' '}
                <strong>
                  {isPrintingSelectedOnly && selectedLogIds.size > 0
                    ? `Selected Audit Records (${selectedLogIds.size} items)`
                    : `Complete Audit Trail (${filteredLogs.length} items)`}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Document Ref:</span>{' '}
                <strong className="font-mono">AUD-TRC-{new Date().getFullYear()}-{logsToDisplay.length}</strong>
              </div>
              <div className="print-timestamp-badge">
                <span className="text-slate-500">Printed:</span>{' '}
                <strong className="font-mono text-slate-900">{printTimestamp || getFormattedTimestamp()}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar (Hidden in Print) */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="text-xs font-semibold text-slate-700">
            Total Logged Events: <span className="text-slate-900">{filteredLogs.length}</span>
            {selectedLogIds.size > 0 && (
              <span className="ml-2 text-blue-600">({selectedLogIds.size} selected)</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Actions --</option>
              <option value="CREATE">CREATE</option>
              <option value="REVERSE">REVERSE</option>
              <option value="UPDATE">UPDATE</option>
            </select>

            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">-- All Entities --</option>
              <option value="CLIENT_INVOICE">Client Invoice</option>
              <option value="PURCHASE">Purchase Bill</option>
              <option value="DIRECT_EXPENSE">Direct Expense</option>
              <option value="MONEY_IN">Money In</option>
              <option value="MONEY_OUT">Money Out</option>
              <option value="TRANSFER">Internal Transfer</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center print:hidden">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleSelectAll}
                    title={isAllFilteredSelected ? 'Deselect all' : 'Select all'}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Entity Type</th>
                <th className="py-2.5 px-4">Entity ID</th>
                <th className="py-2.5 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logsToDisplay.map((log) => {
                const isSelected = selectedLogIds.has(log.id);
                return (
                  <tr
                    key={log.id}
                    onClick={() => handleToggleSelect(log.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td
                      className="py-2.5 px-3 text-center print:hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(log.id)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{log.userName}</span>
                      <span className="text-[10px] text-slate-400 block capitalize">{log.userRole}</span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'CREATE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.action === 'REVERSE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {log.entityType}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {log.entityId}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-sm truncate" title={log.reason}>
                      {log.reason || 'Standard system transaction posted'}
                    </td>
                  </tr>
                );
              })}
              {logsToDisplay.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No audit logs match the current selection or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Official Signatory & Audit Verification Block */}
        <div className="hidden print:block print-signatory-block mt-8 pt-6 border-t border-slate-300 p-4">
          <div className="grid grid-cols-3 gap-6 text-xs text-slate-800">
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-900">Audit Prepared By</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Internal Audit &amp; Compliance Officer</p>
              <div className="h-12 border-b border-dashed border-slate-300 mx-6 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">Signature &amp; Date</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-900">Verified &amp; Reconciled By</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Chief Financial Officer</p>
              <div className="h-12 border-b border-dashed border-slate-300 mx-6 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">Signature &amp; Date</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-bold text-slate-900">Approved Governance</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Managing Partner / Audit Committee</p>
              <div className="h-12 border-b border-dashed border-slate-300 mx-6 my-2"></div>
              <p className="text-[10px] text-slate-400 font-mono">Corporate Seal &amp; Date</p>
            </div>
          </div>
          {/* Automatic Print Timestamp Footer */}
          <div className="print-timestamp-footer mt-6 pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-500 font-mono">
            <span>Artify Construction Accounting System &bull; Immutable Audit Trail (Sultanate of Oman)</span>
            <span>Printed: {printTimestamp || getFormattedTimestamp()} &bull; Total Records: {logsToDisplay.length}</span>
          </div>
        </div>
      </div>

      {/* Print Preview Verification Modal */}
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        onConfirmPrint={handleConfirmPrintFromModal}
        title="Financial System Audit Trail & Transaction Ledger"
        subtitle="Al Tasneem & Partners Construction LLC • Sultanate of Oman • IFRS & GAAP Governance"
        docRef={`AUD-TRC-${new Date().getFullYear()}-${logsForPreview.length}`}
        scope={
          previewSelectedOnly && selectedLogIds.size > 0
            ? `Selected Audit Records (${selectedLogIds.size} items)`
            : `Complete Audit Trail (${filteredLogs.length} items)`
        }
        timestamp={printTimestamp || getFormattedTimestamp()}
        columns={auditPreviewColumns}
        data={logsForPreview}
        emptyMessage="No audit transaction records selected for preview."
        customFooterNote="Artify Construction Accounting System • Immutable Audit Trail (Sultanate of Oman)"
      />
    </div>
  );
};

export default AuditLogView;
