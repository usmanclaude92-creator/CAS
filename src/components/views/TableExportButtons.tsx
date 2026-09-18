import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { TableDensityToggle } from '../TableDensityToggle';

interface TableExportButtonsProps {
  onExportCsv: () => void;
  onExportExcel: () => void;
  onExportPdf?: () => void;
  tableName?: string;
  count?: number;
  className?: string;
  variant?: 'split' | 'dropdown' | 'buttons';
  showDensityToggle?: boolean;
}

export const TableExportButtons: React.FC<TableExportButtonsProps> = ({
  onExportCsv,
  onExportExcel,
  onExportPdf,
  tableName = 'Table',
  count,
  className = '',
  variant = 'buttons',
  showDensityToggle = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'dropdown') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {showDensityToggle && <TableDensityToggle variant="segmented" />}
        <div className="relative inline-block text-left" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-colors cursor-pointer"
            title={`Export ${tableName} to CSV or Excel`}
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Table</span>
            {count !== undefined && (
              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                {count}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {isOpen && (
            <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg bg-white shadow-lg border border-slate-200 py-1 text-xs divide-y divide-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onExportExcel();
                }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-semibold">Export to Excel</div>
                  <div className="text-[10px] text-slate-400 font-mono">.xlsx workbook</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onExportCsv();
                }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-800 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div className="font-semibold">Export to CSV</div>
                  <div className="text-[10px] text-slate-400 font-mono">.csv spreadsheet</div>
                </div>
              </button>
              {onExportPdf && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onExportPdf();
                  }}
                  className="w-full text-left px-3 py-2 text-slate-700 hover:bg-rose-50 hover:text-rose-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Export to PDF</div>
                    <div className="text-[10px] text-slate-400 font-mono">.pdf document</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {showDensityToggle && <TableDensityToggle variant="segmented" />}
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition-colors cursor-pointer"
          title={`Export ${tableName} to Excel-compatible CSV`}
        >
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>CSV</span>
        </button>

        <button
          type="button"
          onClick={onExportExcel}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-xs transition-colors cursor-pointer"
          title={`Export ${tableName} to Excel (.xlsx)`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Excel</span>
        </button>

        {onExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 shadow-xs transition-colors cursor-pointer"
            title={`Export ${tableName} to PDF document`}
          >
            <Download className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
        )}
      </div>
    </div>
  );
};
