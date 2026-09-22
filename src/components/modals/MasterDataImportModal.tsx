import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { accountingService } from '../../services/accountingService';

export type MasterImportType = 'customers' | 'vendors' | 'projects' | 'banks' | 'expense_heads';

interface MasterDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importType: MasterImportType;
  onSuccess?: () => void;
}

export const MasterDataImportModal: React.FC<MasterDataImportModalProps> = ({
  isOpen,
  onClose,
  importType,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    totalRows: number;
    newRecords: number;
    existingRecords: number;
    duplicateRecords: number;
    invalidRecords: number;
    skippedRecords: number;
    message: string;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  // STRICT SECURITY CHECK: UI HIDING & VERIFICATION
  const authCheck = authService.verifyMasterDataImportAuthority();
  if (!authCheck.allowed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-900 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">403 Forbidden</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {authCheck.error || 'Master data bulk import is restricted exclusively to active Super Administrators.'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const getTypeName = () => {
    switch (importType) {
      case 'customers':
        return 'Customers & Clients';
      case 'vendors':
        return 'Vendors & Subcontractors';
      case 'projects':
        return 'Construction Projects';
      case 'banks':
        return 'Commercial Bank Accounts';
      case 'expense_heads':
        return 'Expense Heads & Categories';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  // Simple CSV line parser supporting quoted cells (shared pattern with BatchEntityImportModal)
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

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error('Failed to read the selected file.'));
      reader.readAsText(file);
    });

  const findCol = (header: string[], ...keywords: string[]) =>
    header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const handleExecuteImport = async () => {
    // 1. Independent Backend/Service Security Verification
    const verification = authService.verifyMasterDataImportAuthority();
    if (!verification.allowed) {
      setImportResult({
        success: false,
        totalRows: 0,
        newRecords: 0,
        existingRecords: 0,
        duplicateRecords: 0,
        invalidRecords: 0,
        skippedRecords: 0,
        message: 'Security authorization check failed: 403 Forbidden.',
        error: verification.error,
      });
      return;
    }

    if (!selectedFile) {
      setImportResult({
        success: false,
        totalRows: 0,
        newRecords: 0,
        existingRecords: 0,
        duplicateRecords: 0,
        invalidRecords: 0,
        skippedRecords: 0,
        message: 'Please select a CSV file to import.',
      });
      return;
    }

    const currentUser = authService.getCurrentUser()!;
    setIsProcessing(true);

    try {
      const fileName = selectedFile.name;
      const csvContent = await readFileAsText(selectedFile);
      const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length <= 1) {
        throw new Error('The selected file contains no data rows.');
      }

      const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const dataLines = lines.slice(1).map(parseCSVLine).filter((c) => c.length > 0 && c.some((v) => v));

      let totalRows = dataLines.length;
      let newRecords = 0;
      let duplicateRecords = 0;
      let existingRecords = 0;
      let invalidRecords = 0;
      let skippedRecords = 0;

      const state = accountingService.getState();

      if (importType === 'customers') {
        const codeIdx = findCol(header, 'code');
        const nameIdx = findCol(header, 'name');
        const phoneIdx = findCol(header, 'phone', 'mobile');
        const emailIdx = findCol(header, 'email');
        const addressIdx = findCol(header, 'address');
        const contactIdx = findCol(header, 'contact');
        const balanceIdx = findCol(header, 'balance');
        const existingCodes = new Set(state.customers.map((c) => c.code.toLowerCase()));

        for (const cols of dataLines) {
          const code = (codeIdx >= 0 ? cols[codeIdx] : cols[0] || '').trim();
          const name = (nameIdx >= 0 ? cols[nameIdx] : cols[1] || '').trim();
          if (!code || !name) { invalidRecords++; continue; }
          if (existingCodes.has(code.toLowerCase())) { duplicateRecords++; existingRecords++; continue; }
          await accountingService.createCustomer({
            code,
            name,
            contactPerson: contactIdx >= 0 ? cols[contactIdx] : undefined,
            phone: phoneIdx >= 0 ? cols[phoneIdx] : undefined,
            email: emailIdx >= 0 ? cols[emailIdx] : undefined,
            address: addressIdx >= 0 ? cols[addressIdx] : undefined,
            openingBalance: balanceIdx >= 0 ? parseFloat(cols[balanceIdx]) || 0 : 0,
            status: 'active',
            remarks: 'Imported via Super Admin bulk master import',
          });
          existingCodes.add(code.toLowerCase());
          newRecords++;
        }
      } else if (importType === 'vendors') {
        const codeIdx = findCol(header, 'code');
        const nameIdx = findCol(header, 'name');
        const categoryIdx = findCol(header, 'category');
        const phoneIdx = findCol(header, 'phone', 'mobile');
        const emailIdx = findCol(header, 'email');
        const addressIdx = findCol(header, 'address');
        const balanceIdx = findCol(header, 'balance');
        const existingCodes = new Set(state.vendors.map((v) => v.code.toLowerCase()));

        for (const cols of dataLines) {
          const code = (codeIdx >= 0 ? cols[codeIdx] : cols[0] || '').trim();
          const name = (nameIdx >= 0 ? cols[nameIdx] : cols[1] || '').trim();
          if (!code || !name) { invalidRecords++; continue; }
          if (existingCodes.has(code.toLowerCase())) { duplicateRecords++; existingRecords++; continue; }
          await accountingService.createVendor({
            code,
            name,
            category: categoryIdx >= 0 ? cols[categoryIdx] : undefined,
            phone: phoneIdx >= 0 ? cols[phoneIdx] : undefined,
            email: emailIdx >= 0 ? cols[emailIdx] : undefined,
            address: addressIdx >= 0 ? cols[addressIdx] : undefined,
            openingBalance: balanceIdx >= 0 ? parseFloat(cols[balanceIdx]) || 0 : 0,
            status: 'active',
            remarks: 'Imported via Super Admin bulk master import',
          });
          existingCodes.add(code.toLowerCase());
          newRecords++;
        }
      } else if (importType === 'projects') {
        const codeIdx = findCol(header, 'code');
        const nameIdx = findCol(header, 'name');
        const customerCodeIdx = findCol(header, 'customercode', 'customer');
        const contractIdx = findCol(header, 'contractvalue', 'contract', 'value');
        const startIdx = findCol(header, 'startdate', 'start');
        const existingCodes = new Set(state.projects.map((p) => p.code.toLowerCase()));

        for (const cols of dataLines) {
          const code = (codeIdx >= 0 ? cols[codeIdx] : cols[0] || '').trim();
          const name = (nameIdx >= 0 ? cols[nameIdx] : cols[1] || '').trim();
          const customerCode = customerCodeIdx >= 0 ? (cols[customerCodeIdx] || '').trim() : '';
          const customer = state.customers.find((c) => c.code.toLowerCase() === customerCode.toLowerCase());
          if (!code || !name || !customer) { invalidRecords++; continue; }
          if (existingCodes.has(code.toLowerCase())) { duplicateRecords++; existingRecords++; continue; }
          await accountingService.createProject({
            code,
            name,
            customerId: customer.id,
            contractValue: contractIdx >= 0 ? parseFloat(cols[contractIdx]) || 0 : 0,
            startDate: startIdx >= 0 ? cols[startIdx] || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: 'active',
            remarks: 'Imported via Super Admin bulk master import',
          });
          existingCodes.add(code.toLowerCase());
          newRecords++;
        }
      } else if (importType === 'banks') {
        const bankNameIdx = findCol(header, 'bankname', 'bank');
        const accountNameIdx = findCol(header, 'accountname');
        const accountNumberIdx = findCol(header, 'accountnumber', 'account');
        const balanceIdx = findCol(header, 'balance');

        for (const cols of dataLines) {
          const bankName = (bankNameIdx >= 0 ? cols[bankNameIdx] : cols[0] || '').trim();
          const accountName = (accountNameIdx >= 0 ? cols[accountNameIdx] : cols[1] || '').trim();
          if (!bankName || !accountName) { invalidRecords++; continue; }
          await accountingService.createBankAccount({
            bankName,
            accountName,
            accountNumber: accountNumberIdx >= 0 ? cols[accountNumberIdx] : '',
            currency: 'OMR',
            openingBalance: balanceIdx >= 0 ? parseFloat(cols[balanceIdx]) || 0 : 0,
            status: 'active',
            remarks: 'Imported via Super Admin bulk master import',
          });
          newRecords++;
        }
      } else {
        // expense_heads
        const nameIdx = findCol(header, 'name');
        const categoryIdx = findCol(header, 'category');
        const existingNames = new Set(state.expenseHeads.map((h) => h.name.toLowerCase()));

        for (const cols of dataLines) {
          const name = (nameIdx >= 0 ? cols[nameIdx] : cols[0] || '').trim();
          if (!name) { invalidRecords++; continue; }
          if (existingNames.has(name.toLowerCase())) { duplicateRecords++; existingRecords++; continue; }
          await accountingService.createExpenseHead({
            name,
            category: categoryIdx >= 0 ? cols[categoryIdx] : 'Direct Project Cost',
            status: 'active',
            remarks: 'Imported via Super Admin bulk master import',
          });
          existingNames.add(name.toLowerCase());
          newRecords++;
        }
      }

      // Record Master Data Import Audit Record (Mandatory Requirement 22)
      authService.recordMasterDataImportAudit({
        importType,
        fileName,
        importedByUserId: currentUser.id,
        importedByUserName: currentUser.fullName,
        importedByUserEmail: currentUser.email,
        totalRows,
        newRecords,
        existingRecords,
        duplicateRecords,
        invalidRecords,
        skippedRecords,
        result: newRecords > 0 ? 'success' : 'partial',
      });

      // Also record in system general audit log
      accountingService.addAuditLog(
        'MASTER_DATA_IMPORT',
        'SYSTEM_MASTERS',
        `Super Admin ${currentUser.fullName} executed master-data import for ${getTypeName()}: ${newRecords} new, ${duplicateRecords} duplicate(s). File: ${fileName}`
      );

      setImportResult({
        success: true,
        totalRows,
        newRecords,
        existingRecords,
        duplicateRecords,
        invalidRecords,
        skippedRecords,
        message: `Bulk import completed successfully: ${newRecords} new record(s) inserted, ${duplicateRecords} duplicate(s) safely skipped.`,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setImportResult({
        success: false,
        totalRows: 0,
        newRecords: 0,
        existingRecords: 0,
        duplicateRecords: 0,
        invalidRecords: 0,
        skippedRecords: 0,
        message: 'Import failed due to processing error.',
        error: err?.message || 'Unknown processing error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Super Admin Master Import: {getTypeName()}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Banner */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Super Administrator Privilege Enforced</strong>
            <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
              Only Super Administrators hold authorization to import master records. Every import is verified at API level and immutably logged with row counts.
            </p>
          </div>
        </div>

        {/* Upload Box */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-900 dark:text-white">
            {selectedFile ? selectedFile.name : 'Click to select Excel (.xlsx) or CSV file'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Supports standard Construction ERP templates with automatic code validation and duplicate protection.
          </p>
        </div>

        {/* Import Results Banner */}
        {importResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              importResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {importResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{importResult.message}</span>
            </div>
            {importResult.success && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-800 text-center font-mono text-[11px]">
                <div className="bg-white/70 dark:bg-slate-900/60 p-1.5 rounded">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase">Processed</span>
                  <strong className="text-slate-900 dark:text-white">{importResult.totalRows}</strong>
                </div>
                <div className="bg-white/70 dark:bg-slate-900/60 p-1.5 rounded">
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">New Records</span>
                  <strong className="text-emerald-700 dark:text-emerald-300">+{importResult.newRecords}</strong>
                </div>
                <div className="bg-white/70 dark:bg-slate-900/60 p-1.5 rounded">
                  <span className="block text-[10px] text-amber-600 dark:text-amber-400 uppercase">Duplicates</span>
                  <strong className="text-amber-700 dark:text-amber-300">{importResult.duplicateRecords}</strong>
                </div>
              </div>
            )}
            {importResult.error && (
              <p className="text-[11px] text-rose-700 dark:text-rose-300 font-mono mt-1">
                {importResult.error}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              // Quick download sample template
              const csvContent =
                importType === 'customers'
                  ? 'Code,Name,Phone,Email,OpeningBalance\nCUST-005,Al Khuwair Towers LLC,+968 99887766,towers@khuwair.om,5000'
                  : 'Code,Name,Category,OpeningBalance\nVND-005,Muscat Cement Products,Building Materials,3500';
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Sample_${importType}_template.csv`;
              a.click();
            }}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Sample CSV Template
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isProcessing ? 'Verifying & Importing...' : 'Execute Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterDataImportModal;
