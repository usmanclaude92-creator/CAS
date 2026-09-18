import React from 'react';
import { Rows3, Rows2, ArrowUpDown } from 'lucide-react';
import { useTableDensity, TableDensity } from '../context/TableDensityContext';

interface TableDensityToggleProps {
  variant?: 'segmented' | 'button' | 'header';
  size?: 'xs' | 'sm';
  className?: string;
  showLabel?: boolean;
}

export const TableDensityToggle: React.FC<TableDensityToggleProps> = ({
  variant = 'segmented',
  size = 'xs',
  className = '',
  showLabel = true,
}) => {
  const { density, setDensity, toggleDensity, isCompact } = useTableDensity();

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleDensity}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        title={`Table row spacing: currently ${density}. Click to switch to ${isCompact ? 'Comfortable' : 'Compact'}.`}
        aria-label={`Toggle table row density (Currently ${density})`}
      >
        {isCompact ? (
          <Rows2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <Rows3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
        )}
        {showLabel && (
          <span className="font-medium text-[11px]">
            {isCompact ? 'Compact Spacing' : 'Comfortable Spacing'}
          </span>
        )}
      </button>
    );
  }

  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={toggleDensity}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        title={`Table row density: ${density === 'comfortable' ? 'Comfortable' : 'Compact'}. Click to toggle.`}
        aria-label={`Toggle table density mode (Currently ${density})`}
      >
        {isCompact ? (
          <Rows2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <Rows3 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        )}
        <span className="font-semibold text-[11px] hidden sm:inline">
          {isCompact ? 'Compact' : 'Comfortable'}
        </span>
      </button>
    );
  }

  // Default: Segmented control
  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs ${className}`}
      role="group"
      aria-label="Table row density selector"
    >
      <button
        type="button"
        onClick={() => setDensity('comfortable')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
          !isCompact
            ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        title="Comfortable row spacing (standard padding)"
      >
        <Rows3 className="w-3.5 h-3.5" />
        {showLabel && <span>Comfortable</span>}
      </button>
      <button
        type="button"
        onClick={() => setDensity('compact')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
          isCompact
            ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        title="Compact row spacing (higher data density for financial reports)"
      >
        <Rows2 className="w-3.5 h-3.5" />
        {showLabel && <span>Compact</span>}
      </button>
    </div>
  );
};

export default TableDensityToggle;
