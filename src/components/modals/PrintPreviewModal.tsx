import React, { useState } from 'react';
import {
  Printer,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  CheckCircle2,
  Maximize2,
  FileSpreadsheet,
} from 'lucide-react';
import { ArtifyLogo } from '../ArtifyLogo';

export interface PrintPreviewColumn<T = any> {
  header: string;
  accessor: keyof T | ((row: T, index: number) => React.ReactNode);
  align?: 'left' | 'center' | 'right';
  isMono?: boolean;
  width?: string;
}

export interface PrintPreviewModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrint: () => void;
  title: string;
  subtitle?: string;
  docRef?: string;
  scope?: string;
  period?: string;
  currency?: string;
  timestamp?: string;
  columns?: PrintPreviewColumn<T>[];
  data?: T[];
  summaryRow?: React.ReactNode;
  emptyMessage?: string;
  customFooterNote?: string;
  children?: React.ReactNode;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmPrint,
  title,
  subtitle = 'Al Tasneem & Partners Construction LLC • Sultanate of Oman • IFRS & GAAP Governance',
  docRef,
  scope,
  period,
  currency = 'OMR (Numeric 18, 3)',
  timestamp,
  columns,
  data = [],
  summaryRow,
  emptyMessage = 'No transactions selected for print preview.',
  customFooterNote,
  children,
}) => {
  const [zoom, setZoom] = useState<number>(100);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 150));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoom(100);

  const formattedTimestamp =
    timestamp ||
    (() => {
      const now = new Date();
      return `${now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })} ${now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })}`;
    })();

  const computedDocRef =
    docRef || `DOC-PRN-${new Date().getFullYear()}-${String(data.length).padStart(3, '0')}`;

  const computedScope =
    scope || (data.length > 0 ? `Selected Transactions (${data.length} items)` : 'All Records');

  const handlePrintClick = () => {
    onConfirmPrint();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-preview-title"
    >
      {/* Top Application Toolbar */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between gap-4 shrink-0 shadow-md">
        {/* Left: Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h2
                id="print-preview-title"
                className="text-sm sm:text-base font-bold text-white truncate"
              >
                Print Preview
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <CheckCircle2 className="w-3 h-3" />
                A4 Stylesheet Layout
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {title} &bull; {data.length} {data.length === 1 ? 'record' : 'records'}
            </p>
          </div>
        </div>

        {/* Center: Zoom & View Controls */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 60}
            className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
            title="Zoom Out (-15%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs font-semibold px-2 min-w-12 text-center text-slate-200">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 150}
            className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
            title="Zoom In (+15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1"></div>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 hover:text-white hover:bg-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
            title="Reset Zoom to 100%"
          >
            Reset (100%)
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrintClick}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-md hover:shadow-blue-600/30 transition-all cursor-pointer"
            title="Send layout directly to browser's native print / PDF dialog"
          >
            <Printer className="w-4 h-4 text-blue-100" />
            <span>Commit to Print (PDF)</span>
          </button>
        </div>
      </header>

      {/* Main Preview Viewing Area (Scrollable Slate Desk) */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-800/90 flex justify-center items-start">
        {/* Scalable Container */}
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="w-full max-w-[210mm] transition-all"
        >
          {/* Simulated A4 Paper Sheet */}
          <div className="bg-white text-slate-900 shadow-2xl rounded-xs p-8 sm:p-10 border border-slate-300 min-h-[297mm] flex flex-col justify-between">
            {/* Sheet Content Top */}
            <div>
              {/* Document Header - Exact Print Stylesheet Layout */}
              <div className="pb-4 mb-6 border-b-2 border-slate-900">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-4">
                    <ArtifyLogo className="h-12 w-auto shrink-0" />
                    <div>
                      <h1 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight">
                        {title}
                      </h1>
                      <p className="text-xs font-medium text-slate-600 mt-0.5">{subtitle}</p>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-700 space-y-0.5 shrink-0 pl-4">
                    <div>
                      <span className="text-slate-500">Scope:</span>{' '}
                      <strong className="text-slate-900">{computedScope}</strong>
                    </div>
                    {period && (
                      <div>
                        <span className="text-slate-500">Period:</span>{' '}
                        <strong className="text-slate-900">{period}</strong>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Doc Ref:</span>{' '}
                      <strong className="font-mono text-slate-900">{computedDocRef}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Currency:</span>{' '}
                      <strong className="text-slate-900">{currency}</strong>
                    </div>
                    <div className="pt-0.5">
                      <span className="text-slate-500">Print Timestamp:</span>{' '}
                      <strong className="font-mono text-slate-900">{formattedTimestamp}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layout Verification Banner */}
              <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-2.5 px-3 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>
                    Print Verification Mode &bull; Layout matches physical A4 margin standards (12mm
                    borders)
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  Total Items: {data.length}
                </span>
              </div>

              {/* Custom Children or Standard Data Table */}
              {children ? (
                <div>{children}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-t border-b-2 border-slate-400 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                        {columns?.map((col, idx) => (
                          <th
                            key={idx}
                            className={`py-2 px-3 ${
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            } ${col.width || ''}`}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.length === 0 ? (
                        <tr>
                          <td
                            colSpan={columns?.length || 1}
                            className="text-center py-10 text-slate-400 italic text-xs"
                          >
                            {emptyMessage}
                          </td>
                        </tr>
                      ) : (
                        data.map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            className={`hover:bg-blue-50/40 transition-colors ${
                              rowIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                            }`}
                          >
                            {columns?.map((col, colIdx) => {
                              const value =
                                typeof col.accessor === 'function'
                                  ? col.accessor(row, rowIdx)
                                  : (row as any)[col.accessor];

                              return (
                                <td
                                  key={colIdx}
                                  className={`py-2 px-3 border-x border-slate-100 text-slate-700 ${
                                    col.isMono ? 'font-mono' : ''
                                  } ${
                                    col.align === 'right'
                                      ? 'text-right'
                                      : col.align === 'center'
                                      ? 'text-center'
                                      : 'text-left'
                                  }`}
                                >
                                  {value}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}

                      {/* Optional Grand Total / Summary Row */}
                      {summaryRow}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sheet Content Bottom: Official Signatory & Footer */}
            <div className="mt-8 pt-6 border-t border-slate-300">
              {/* 3-Column Corporate Signatory Block */}
              <div className="grid grid-cols-3 gap-6 text-xs text-slate-800">
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-900">Audit Prepared By</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Internal Audit &amp; Compliance Officer
                  </p>
                  <div className="h-10 border-b border-dashed border-slate-300 mx-4 my-2"></div>
                  <p className="text-[9px] text-slate-400 font-mono">Signature &amp; Date</p>
                </div>
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-900">Verified &amp; Reconciled By</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Chief Financial Officer</p>
                  <div className="h-10 border-b border-dashed border-slate-300 mx-4 my-2"></div>
                  <p className="text-[9px] text-slate-400 font-mono">Signature &amp; Date</p>
                </div>
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-900">Approved Governance</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Managing Partner / Audit Committee
                  </p>
                  <div className="h-10 border-b border-dashed border-slate-300 mx-4 my-2"></div>
                  <p className="text-[9px] text-slate-400 font-mono">Corporate Seal &amp; Date</p>
                </div>
              </div>

              {/* Automatic Printed Timestamp & Legal Footer */}
              <div className="mt-6 pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-500 font-mono">
                <span>
                  {customFooterNote ||
                    'Artify Construction Accounting System • Immutable Audit Trail & Financial Statements (Sultanate of Oman)'}
                </span>
                <span>
                  Printed: {formattedTimestamp} &bull; Records: {data.length} &bull; Ref:{' '}
                  {computedDocRef}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
