/**
 * Financial precision formatters and safe 3-decimal arithmetic for OMR (Omani Rial)
 */

export const CURRENCY = 'OMR';

/**
 * Format a number as OMR currency string with 3 decimal places
 * Example: 1250 -> "OMR 1,250.000"
 * Example: -50 -> "-OMR 50.000"
 */
export function formatOMR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'OMR 0.000';
  }
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const parts = absNum.toFixed(3).split('.');
  // Add thousands separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = `${parts[0]}.${parts[1]}`;

  return isNegative ? `-OMR ${formatted}` : `OMR ${formatted}`;
}

/**
 * Format raw number with 3 decimals without currency prefix
 */
export function formatNumber3Decimals(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0.000';
  }
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const parts = absNum.toFixed(3).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = `${parts[0]}.${parts[1]}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Safe 3-decimal floating point addition to prevent JS precision issues
 */
export function addMoney(...amounts: (number | string | null | undefined)[]): number {
  const sumScaled = amounts.reduce<number>((acc, val) => {
    if (val === null || val === undefined || isNaN(Number(val))) return acc;
    return acc + Math.round(Number(val) * 1000);
  }, 0);
  return sumScaled / 1000;
}

/**
 * Safe 3-decimal floating point subtraction (a - b)
 */
export function subtractMoney(
  a: number | string | null | undefined,
  b: number | string | null | undefined
): number {
  const aScaled = Math.round(Number(a || 0) * 1000);
  const bScaled = Math.round(Number(b || 0) * 1000);
  return (aScaled - bScaled) / 1000;
}

/**
 * Safe 3-decimal floating point multiplication
 */
export function multiplyMoney(
  a: number | string | null | undefined,
  multiplier: number | string | null | undefined
): number {
  const numA = Number(a || 0);
  const numM = Number(multiplier || 0);
  return Math.round(numA * numM * 1000) / 1000;
}

/**
 * Parse input string to safe 3-decimal numeric
 */
export function parseMoney(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 1000) / 1000;
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 1000) / 1000;
}

/**
 * Format standard ISO date to clean readable date
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format ISO date & time for audit logs
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

/**
 * Format a decimal/percentage as a string with 2 decimal places
 * Example: 24.5 -> "24.50%"
 */
export function formatPercent(percent: number | string | null | undefined): string {
  if (percent === null || percent === undefined || isNaN(Number(percent))) {
    return '0.00%';
  }
  return `${Number(percent).toFixed(2)}%`;
}

