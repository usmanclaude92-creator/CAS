import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ShieldCheck,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { authService } from '../../services/authService';
import { accountingService } from '../../services/accountingService';
import { downloadClientInvoiceImportTemplate } from '../../utils/clientInvoiceImportTemplate';
import {
  parseClientInvoiceImportRows,
  classifyClientInvoiceImportRows,
  ClientInvoiceImportRowResult,
} from '../../utils/clientInvoiceImportValidation';
import { formatOMR } from '../../utils/formatters';

interface ClientInvoiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ImportPhase = 'upload' | 'review' | 'result';

interface ImportSummary {
  success: boolean;
  totalRows: number;
  postedCount: number;
  failedRows: { rowNumber: number; message: string }[];
}

export const ClientInvoiceImportModal: React.FC<ClientInvoiceImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>('upload');
  const [fileName, setFileName] = useState('');
  const [rowResults, setRowResults] = useState<ClientInvoiceImportRowResult[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setPhase('upload');
    setFileName('');
    setRowResults([]);
    setParseError(null);
    setSummary(null);
  };

  const handleCloseModal = () => {
    reset();
    onClose();
  };

  const authCheck = authService.verifyClientInvoiceImportAuthority();
  if (!authCheck.allowed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-900 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">403 Forbidden</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {authCheck.error ||
              'Invoice import requires the "invoices.import" permission, grantable to a role under Roles & Permissions.'}
          </p>
          <button
            onClick={handleCloseModal}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const parseSpreadsheetFile = (file: File): Promise<string[][]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
          resolve(rows.map((row) => row.map((cell) => String(cell ?? '').trim())));
        } catch {
          reject(new Error('Failed to parse the selected file. Please use a valid .xlsx or .csv file.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read the selected file.'));
      reader.readAsArrayBuffer(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);
    setIsProcessing(true);
    try {
      const grid = await parseSpreadsheetFile(file);
      const raw = parseClientInvoiceImportRows(grid);
      if (raw.length === 0) {
        setParseError('The selected file contains no data rows.');
        setIsProcessing(false);
        return;
      }
      const state = accountingService.getState();
      const results = classifyClientInvoiceImportRows(raw, state);
      setRowResults(results);
      setPhase('review');
    } catch (err: any) {
      setParseError(err?.message || 'Failed to process the selected file.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const blockingRows = rowResults.filter((r) => r.status === 'error');
  const newRows = rowResults.filter((r) => r.status === 'new');
  const canImport = blockingRows.length === 0 && rowResults.length > 0;

  const handleConfirmImport = async () => {
    if (!canImport) return;
    setIsProcessing(true);

    const currentUser = authService.getCurrentUser()!;
    const failedRows: { rowNumber: number; message: string }[] = [];
    let postedCount = 0;

    for (const row of newRows) {
      const r = row.resolved!;
      try {
        await accountingService.importClientInvoice({
          invoiceType: r.invoiceType,
          invoiceNumber: r.invoiceNumber,
          date: r.date,
          customerId: r.customerId,
          projectId: r.projectId,
          description: r.description,
          netAmount: r.netAmount,
          vatRate: r.vatRate,
          vatTreatment: r.vatTreatment,
          documentRef: r.documentRef,
          remarks: r.remarks,
        });
        postedCount++;
      } catch (err: any) {
        failedRows.push({ rowNumber: row.rowNumber, message: err?.message || 'Unknown error posting this row.' });
      }
    }

    accountingService.addAuditLog(
      'BULK_IMPORT_CLIENT_INVOICES',
      'Invoices & IPC',
      `${currentUser.fullName} imported Client Invoices/IPCs from "${fileName}": ${postedCount} new, ${failedRows.length} failed. Total rows in file: ${rowResults.length}.`
    );

    setSummary({
      success: failedRows.length === 0,
      totalRows: rowResults.length,
      postedCount,
      failedRows,
    });
    setPhase('result');
    setIsProcessing(false);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Import Client Invoices / IPCs</span>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {phase === 'upload' && (
            <>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Permission-Gated & Fully Audited</strong>
                  <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                    Only users whose role holds the "invoices.import" permission may run this import. Each row's
                    real invoice number is preserved exactly as given — it is not reassigned a new
                    sequential number — and a number that already exists anywhere in the system blocks the
                    whole file until fixed.
                  </p>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {isProcessing ? 'Reading file…' : 'Click to select Excel (.xlsx) or CSV file'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Customer Name and Project Name must match existing records exactly.
                </p>
              </div>

              {parseError && (
                <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={downloadClientInvoiceImportTemplate}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel Import Template
              </button>
            </>
          )}

          {phase === 'review' && (
            <>
              <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                  <span className="block text-slate-500 dark:text-slate-400 uppercase">New Invoices</span>
                  <strong className="text-emerald-700 dark:text-emerald-300 text-sm">{newRows.length}</strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                  <span className="block text-slate-500 dark:text-slate-400 uppercase">Rows With Issues</span>
                  <strong className="text-rose-700 dark:text-rose-300 text-sm">{blockingRows.length}</strong>
                </div>
              </div>

              {blockingRows.length > 0 && (
                <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Nothing will be imported until every issue below is fixed in the source file and re-uploaded —
                    this import is all-or-nothing.
                  </span>
                </div>
              )}

              {blockingRows.length > 0 && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-800 divide-y divide-rose-100 dark:divide-rose-900 max-h-56 overflow-y-auto">
                  {blockingRows.map((row) => (
                    <div key={row.rowNumber} className="p-2.5 text-[11px]">
                      <div className="font-semibold text-rose-800 dark:text-rose-200">Row {row.rowNumber}</div>
                      <ul className="list-disc list-inside text-rose-700 dark:text-rose-300 mt-0.5 space-y-0.5">
                        {row.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {newRows.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    New invoices to post ({newRows.length})
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                    {newRows.map((row) => (
                      <div key={row.rowNumber} className="p-2.5 text-[11px] flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-300">
                          Row {row.rowNumber} — {row.resolved?.invoiceNumber} · {row.resolved?.date} ·{' '}
                          {row.resolved?.customerName}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {formatOMR(row.resolved?.grossAmount || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {phase === 'result' && summary && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                summary.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {summary.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {summary.success
                    ? `Import complete: ${summary.postedCount} invoice(s) posted.`
                    : `Import partially completed before a row failed: ${summary.postedCount} posted, ${summary.failedRows.length} failed.`}
                </span>
              </div>
              {summary.failedRows.length > 0 && (
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-1">
                  <p className="font-semibold">
                    These rows did not complete — remove the successfully-imported rows from your file and re-upload just these:
                  </p>
                  {summary.failedRows.map((f) => (
                    <p key={f.rowNumber} className="font-mono text-[11px]">
                      Row {f.rowNumber}: {f.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {phase === 'review' ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload a different file
            </button>
          ) : (
            <span />
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv" className="hidden" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              {phase === 'result' ? 'Close' : 'Cancel'}
            </button>
            {phase === 'review' && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!canImport || isProcessing}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Importing…' : `Confirm & Import (${newRows.length} row${newRows.length === 1 ? '' : 's'})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientInvoiceImportModal;
