/**
 * Helper utilities for Report Quick Filtering (Date ranges, Aging brackets, Sorting)
 */

export type DatePreset =
  | 'all'
  | 'today'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface DateRangeResult {
  startDate: string | null;
  endDate: string | null;
  label: string;
}

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Compute start and end date strings based on preset
 */
export function getDateRangeFromPreset(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string
): DateRangeResult {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 to 11

  switch (preset) {
    case 'today': {
      const todayStr = formatDateToYYYYMMDD(now);
      return {
        startDate: todayStr,
        endDate: todayStr,
        label: 'Today',
      };
    }
    case 'this_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        startDate: formatDateToYYYYMMDD(start),
        endDate: formatDateToYYYYMMDD(end),
        label: start.toLocaleString('default', { month: 'short', year: 'numeric' }),
      };
    }
    case 'last_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return {
        startDate: formatDateToYYYYMMDD(start),
        endDate: formatDateToYYYYMMDD(end),
        label: start.toLocaleString('default', { month: 'short', year: 'numeric' }),
      };
    }
    case 'this_quarter': {
      const qStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(year, qStartMonth, 1);
      const end = new Date(year, qStartMonth + 3, 0);
      const qNum = Math.floor(month / 3) + 1;
      return {
        startDate: formatDateToYYYYMMDD(start),
        endDate: formatDateToYYYYMMDD(end),
        label: `Q${qNum} ${year}`,
      };
    }
    case 'this_year': {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return {
        startDate: formatDateToYYYYMMDD(start),
        endDate: formatDateToYYYYMMDD(end),
        label: `FY ${year}`,
      };
    }
    case 'last_year': {
      const start = new Date(year - 1, 0, 1);
      const end = new Date(year - 1, 11, 31);
      return {
        startDate: formatDateToYYYYMMDD(start),
        endDate: formatDateToYYYYMMDD(end),
        label: `FY ${year - 1}`,
      };
    }
    case 'custom': {
      const start = customStart || null;
      const end = customEnd || null;
      let label = 'Custom Period';
      if (start && end) label = `${start} to ${end}`;
      else if (start) label = `From ${start}`;
      else if (end) label = `Up to ${end}`;
      return {
        startDate: start,
        endDate: end,
        label,
      };
    }
    case 'all':
    default:
      return {
        startDate: null,
        endDate: null,
        label: 'All Time',
      };
  }
}

/**
 * Check if a date string falls inside a date range
 */
export function isDateInRange(
  dateStr: string | undefined | null,
  startDate: string | null,
  endDate: string | null
): boolean {
  if (!dateStr) return false;
  // Normalize to YYYY-MM-DD
  const pureDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  if (startDate && pureDate < startDate) return false;
  if (endDate && pureDate > endDate) return false;
  return true;
}

export type AgingBracketType = 'all' | '0_30' | '31_60' | '61_90' | 'over_90';

/**
 * Calculate age in days from document date
 */
export function calculateAgingDays(dateStr: string, asOfDateStr?: string): number {
  if (!dateStr) return 0;
  const docDate = new Date(dateStr.includes('T') ? dateStr.split('T')[0] : dateStr);
  const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
  const diffTime = asOf.getTime() - docDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Categorize into aging brackets
 */
export function getAgingBracket(days: number): '0_30' | '31_60' | '61_90' | 'over_90' {
  if (days <= 30) return '0_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  return 'over_90';
}

/**
 * Get readable label & Tailwind badge styling for aging bracket
 */
export function getAgingBadge(days: number): { label: string; badgeClass: string; bracket: AgingBracketType } {
  const bracket = getAgingBracket(days);
  switch (bracket) {
    case '0_30':
      return {
        label: `0 - 30 Days (${days}d)`,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bracket: '0_30',
      };
    case '31_60':
      return {
        label: `31 - 60 Days (${days}d)`,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        bracket: '31_60',
      };
    case '61_90':
      return {
        label: `61 - 90 Days (${days}d)`,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        bracket: '61_90',
      };
    case 'over_90':
    default:
      return {
        label: `> 90 Days (${days}d overdue)`,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        bracket: 'over_90',
      };
  }
}
