import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Users,
  Truck,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { accountingService } from '../../services/accountingService';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';

export type BatchEntityType = 'customers' | 'vendors';

export interface ValidatedRow {
  index: number;
  data: {
    code: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    openingBalance: number;
    remarks?: string;
  };
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
}

interface BatchEntityImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: BatchEntityType;
  onImportComplete?: () => void;
}

export const BatchEntityImportModal: React.FC<BatchEntityImportModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'customers',
  onImportComplete,
}) => {
  const { toast } = useToast();
  const [entityType, setEntityType] = useState<BatchEntityType>(defaultType);
  const [step, setStep] = useState<'upload' | 'validate' | 'success'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ imported: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download CSV template
  const handleDownloadTemplate = () => {
    let headers = '';
    let sampleRow = '';

    if (entityType === 'customers') {
      headers = 'code,name,contactPerson,phone,email,address,openingBalance,remarks';
      sampleRow = 'CUST-009,Al Bustan Palace Hotel,Said Al Harthy,+968 9112 2334,said@albustan.om,Muscat Oman,2500,Hospitality development client';
    } else {
      headers = 'code,name,contactPerson,phone,email,address,openingBalance,remarks';
      sampleRow = 'VEND-009,Muscat ReadyMix Concrete LLC,Eng. Ahmed Al-Balushi,+968 9223 3445,sales@muscatreadymix.om,Ghala Industrial Muscat,0,Primary C40 concrete vendor';
    }

    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${sampleRow}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${entityType}_batch_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.info('Template Downloaded', `CSV template for ${entityType} ready to open.`);
  };

  // Simple CSV line parser supporting quoted cells
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        validateCSV(text);
      }
    };
    reader.readAsText(selected);
  };

  const validateCSV = (csvContent: string) => {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      toast.error('Empty File', 'The selected CSV file does not contain any data rows.');
      return;
    }

    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const codeIdx = header.indexOf('code');
    const nameIdx = header.indexOf('name');
    const contactIdx = header.findIndex((h) => h.includes('contact'));
    const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile'));
    const emailIdx = header.findIndex((h) => h.includes('email'));
    const addressIdx = header.findIndex((h) => h.includes('address'));
    const balanceIdx = header.findIndex((h) => h.includes('balance'));
    const remarksIdx = header.findIndex((h) => h.includes('remark') || h.includes('note'));

    const state = accountingService.getState();
    const existingCodes = new Set(
      entityType === 'customers'
        ? state.customers.map((c) => c.code.toUpperCase())
        : state.vendors.map((v) => v.code.toUpperCase())
    );

    const parsedRows: ValidatedRow[] = [];
    const seenFileCodes = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      const code = (codeIdx >= 0 ? cols[codeIdx] : cols[0] || '').trim().toUpperCase();
      const name = (nameIdx >= 0 ? cols[nameIdx] : cols[1] || '').trim();
      const contactPerson = contactIdx >= 0 ? cols[contactIdx] : cols[2] || '';
      const phone = phoneIdx >= 0 ? cols[phoneIdx] : cols[3] || '';
      const email = emailIdx >= 0 ? cols[emailIdx] : cols[4] || '';
      const address = addressIdx >= 0 ? cols[addressIdx] : cols[5] || '';
      const rawBalance = balanceIdx >= 0 ? cols[balanceIdx] : cols[6] || '0';
      const remarks = remarksIdx >= 0 ? cols[remarksIdx] : cols[7] || '';

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validation
      if (!code) {
        errors.push('Entity Code is mandatory.');
      } else if (code.length < 3) {
        errors.push('Code must be at least 3 characters.');
      } else if (existingCodes.has(code)) {
        errors.push(`Code "${code}" already exists in the database.`);
      } else if (seenFileCodes.has(code)) {
        errors.push(`Duplicate code "${code}" within this CSV file.`);
      }

      if (code) seenFileCodes.add(code);

      if (!name) {
        errors.push('Business Name is required.');
      }

      let openingBalance = 0;
      if (rawBalance) {
        const num = parseFloat(rawBalance.replace(/[^0-9.-]/g, ''));
        if (isNaN(num)) {
          warnings.push('Opening balance could not be parsed; set to 0.');
        } else {
          openingBalance = num;
        }
      }

      if (email && !email.includes('@')) {
        warnings.push('Email format appears invalid.');
      }

      if (!phone) {
        warnings.push('No telephone number provided.');
      }

      const status: 'valid' | 'warning' | 'error' =
        errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

      parsedRows.push({
        index: i,
        data: {
          code,
          name,
          contactPerson,
          phone,
          email,
          address,
          openingBalance,
          remarks,
        },
        status,
        errors,
        warnings,
      });
    }

    setRows(parsedRows);
    setStep('validate');
  };

  const handleCommit = async () => {
    const validRows = rows.filter((r) => r.status !== 'error');
    if (validRows.length === 0) {
      toast.error('Cannot Commit', 'No valid records found in the uploaded file.');
      return;
    }

    setIsCommitting(true);
    let imported = 0;
    let failed = 0;

    try {
      for (const row of validRows) {
        try {
          if (entityType === 'customers') {
            await accountingService.createCustomer({
              code: row.data.code,
              name: row.data.name,
              contactPerson: row.data.contactPerson,
              phone: row.data.phone,
              email: row.data.email,
              address: row.data.address,
              openingBalance: row.data.openingBalance,
              status: 'active',
              remarks: row.data.remarks || 'Batch imported via CSV',
            });
          } else {
            await accountingService.createVendor({
              code: row.data.code,
              name: row.data.name,
              contactPerson: row.data.contactPerson,
              phone: row.data.phone,
              email: row.data.email,
              address: row.data.address,
              openingBalance: row.data.openingBalance,
              status: 'active',
              remarks: row.data.remarks || 'Batch imported via CSV',
            });
          }
          imported++;
        } catch (e) {
          failed++;
        }
      }

      setCommitResult({ imported, failed });
      setStep('success');
      toast.success(
        'Batch Import Completed',
        `Successfully committed ${imported} ${entityType} to the database.`
      );
      if (onImportComplete) onImportComplete();
    } catch (err: any) {
      toast.error('Commit Error', err?.message || 'Failed to complete batch transaction.');
    } finally {
      setIsCommitting(false);
    }
  };

  const validCount = rows.filter((r) => r.status !== 'error').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              {entityType === 'customers' ? <Users className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Batch Import {entityType === 'customers' ? 'Clients & Customers' : 'Vendors & Subcontractors'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a structured CSV file, validate master records, and commit to database
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="p-6 space-y-5">
            {/* Entity Selector & Template Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  Select Master Data Target
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEntityType('customers')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      entityType === 'customers'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Customers / Clients
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntityType('vendors')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      entityType === 'vendors'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Vendors / Subcontractors
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 cursor-pointer shrink-0 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV Template
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-950/30 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelected}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Click or Drag CSV File Here
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                File must match template headers: code, name, phone, email, openingBalance, remarks.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Validate Preview */}
        {step === 'validate' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Validation Metric Summary */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Total Parsed: <strong>{rows.length}</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  {validCount} Ready to Commit
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full">
                    <XCircle className="w-3 h-3" />
                    {errorCount} Errors Blocked
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep('upload')}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Upload Different File
              </button>
            </div>

            {/* Validation Table */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                    <th className="pb-2 pl-2">#</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Contact</th>
                    <th className="pb-2">Opening Bal</th>
                    <th className="pb-2 pr-2">Issues / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <tr
                      key={row.index}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        row.status === 'error'
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : row.status === 'warning'
                          ? 'bg-amber-50/30 dark:bg-amber-950/10'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 pl-2 font-mono text-slate-400">{row.index}</td>
                      <td className="py-2.5">
                        {row.status === 'valid' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> VALID
                          </span>
                        )}
                        {row.status === 'warning' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3" /> WARNING
                          </span>
                        )}
                        {row.status === 'error' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <XCircle className="w-3 h-3" /> ERROR
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        {row.data.code || '-'}
                      </td>
                      <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                        {row.data.name}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-400">
                        {row.data.contactPerson || row.data.phone || '-'}
                      </td>
                      <td className="py-2.5 font-mono text-slate-700 dark:text-slate-300">
                        {row.data.openingBalance.toFixed(3)}
                      </td>
                      <td className="py-2.5 pr-2">
                        {row.errors.length > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 text-[11px] block font-medium">
                            {row.errors.join(', ')}
                          </span>
                        )}
                        {row.warnings.length > 0 && row.errors.length === 0 && (
                          <span className="text-amber-600 dark:text-amber-400 text-[11px] block">
                            {row.warnings.join(', ')}
                          </span>
                        )}
                        {row.errors.length === 0 && row.warnings.length === 0 && (
                          <span className="text-slate-400 text-[11px]">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Commit Action Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Back to Upload
              </button>

              <button
                type="button"
                disabled={validCount === 0 || isCommitting}
                onClick={handleCommit}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Committing to Database...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Commit {validCount} Valid {entityType === 'customers' ? 'Customers' : 'Vendors'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success Confirmation */}
        {step === 'success' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Batch Import Completed Successfully
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              Committed <strong>{commitResult?.imported || 0}</strong> {entityType} to the local database and live Supabase instance.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 cursor-pointer"
              >
                Close &amp; View Directory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchEntityImportModal;
