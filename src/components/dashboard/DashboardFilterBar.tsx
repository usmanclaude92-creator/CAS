import React, { useState } from 'react';
import {
  Building2,
  HardHat,
  Calendar,
  RotateCcw,
  FileSpreadsheet,
  Plus,
  ChevronDown,
  Layers,
  Filter,
  Receipt,
  Truck,
  Coins,
  ArrowRightLeft,
} from 'lucide-react';
import { Project } from '../../types';
import { DatePreset } from '../../utils/reportFilters';

export interface DashboardFilterBarProps {
  scope: 'overall' | 'project';
  onScopeChange: (scope: 'overall' | 'project') => void;
  selectedProjectId: string | null;
  onSelectProjectId: (projectId: string | null) => void;
  projects: Project[];
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
  periodLabel: string;
  onResetFilters: () => void;
  isFilterActive: boolean;
  onExportExcel: () => void;
  onOpenClientInvoice: (projectId?: string) => void;
  onOpenPurchase: (projectId?: string) => void;
  onOpenExpense: (projectId?: string) => void;
  onOpenMoneyIn: (projectId?: string) => void;
  onOpenMoneyOut: () => void;
  onOpenTransfer?: () => void;
}

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  scope,
  onScopeChange,
  selectedProjectId,
  onSelectProjectId,
  projects,
  datePreset,
  onDatePresetChange,
  customStartDate,
  customEndDate,
  onCustomStartChange,
  onCustomEndChange,
  periodLabel,
  onResetFilters,
  isFilterActive,
  onExportExcel,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenMoneyIn,
  onOpenMoneyOut,
  onOpenTransfer,
}) => {
  const [showCustomDates, setShowCustomDates] = useState(datePreset === 'custom');

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handlePresetSelect = (preset: DatePreset) => {
    onDatePresetChange(preset);
    if (preset === 'custom') {
      setShowCustomDates(true);
    } else {
      setShowCustomDates(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4 print:hidden transition-colors">
      {/* Top Row: Scope Selector & Action Hub */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Scope Selector: Overall vs Project */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
            Scope:
          </span>

          {/* Overall (Company-Wide) Button */}
          <button
            type="button"
            onClick={() => {
              onScopeChange('overall');
              onSelectProjectId(null);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              scope === 'overall'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-500" />
            <span>Overall (Company-wide)</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                scope === 'overall'
                  ? 'bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {projects.length} Projects
            </span>
          </button>

          {/* Project-Wise Dropdown / Button */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => {
                if (scope !== 'project') {
                  onScopeChange('project');
                  if (!selectedProjectId && projects.length > 0) {
                    onSelectProjectId(projects[0].id);
                  }
                }
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                scope === 'project'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
            >
              <HardHat className="w-4 h-4 text-amber-400" />
              <span>Project-Wise Analytics</span>
            </button>
          </div>

          {/* Project Dropdown Selector when in Project Mode or switching */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <select
              value={selectedProjectId || ''}
              onChange={(e) => {
                const pId = e.target.value;
                if (pId) {
                  onSelectProjectId(pId);
                  onScopeChange('project');
                } else {
                  onSelectProjectId(null);
                  onScopeChange('overall');
                }
              }}
              className={`w-full text-xs font-medium py-2 pl-3 pr-8 rounded-xl border transition-colors cursor-pointer appearance-none ${
                scope === 'project'
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">-- Switch to Project Drilldown --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name} {p.customerName ? `• ${p.customerName}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Right side: Quick Action Buttons & Excel Export */}
        <div className="flex flex-wrap items-center gap-2">
          {isFilterActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
              title="Reset all filters to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="Export current dashboard analytics to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Analytics</span>
          </button>

          {/* Quick Transaction Action Dropdown / Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenClientInvoice(selectedProjectId || undefined)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-700 hover:bg-blue-600 transition-colors cursor-pointer shadow-2xs"
              title="Raise Client Invoice / IPC"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>+ Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenPurchase(selectedProjectId || undefined)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-white bg-amber-700 hover:bg-amber-600 transition-colors cursor-pointer shadow-2xs"
              title="Record Vendor Purchase Bill"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>+ Purchase</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenExpense(selectedProjectId || undefined)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-white bg-rose-700 hover:bg-rose-600 transition-colors cursor-pointer shadow-2xs"
              title="Record Direct Site Expense"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>+ Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Period Filter Strip */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Date Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Period:
          </span>

          {[
            { id: 'all', label: 'All Time' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_quarter', label: 'This Quarter' },
            { id: 'this_year', label: 'This Year' },
            { id: 'custom', label: 'Custom' },
          ].map((preset) => {
            const isSelected = datePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset.id as DatePreset)}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Current Active Range Badge or Custom Inputs */}
        <div className="flex flex-wrap items-center gap-2">
          {showCustomDates ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">Selected Range:</span>
              <span className="px-2.5 py-0.5 rounded-md font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                {periodLabel}
              </span>
            </div>
          )}

          {scope === 'project' && selectedProject && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Drilldown:</span>
              <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 font-mono">
                {selectedProject.code}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
