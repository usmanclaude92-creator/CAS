import { describe, it, expect } from 'vitest';
import { addMoney, subtractMoney, multiplyMoney, parseMoney, formatOMR, formatNumber3Decimals, formatPercent } from './formatters';

describe('addMoney', () => {
  it('sums multiple amounts without floating point drift', () => {
    // 0.1 + 0.2 famously equals 0.30000000000000004 in raw JS floats.
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it('handles many small amounts summing to a large total', () => {
    const amounts = Array(1000).fill(0.001);
    expect(addMoney(...amounts)).toBe(1);
  });

  it('ignores null/undefined/NaN entries', () => {
    expect(addMoney(10, null, undefined, NaN as unknown as number, 5)).toBe(15);
  });

  it('returns 0 for no arguments', () => {
    expect(addMoney()).toBe(0);
  });
});

describe('subtractMoney', () => {
  it('subtracts precisely at 3 decimal places', () => {
    expect(subtractMoney(10.003, 0.001)).toBe(10.002);
  });

  it('treats missing operands as 0', () => {
    expect(subtractMoney(undefined, 5)).toBe(-5);
    expect(subtractMoney(5, undefined)).toBe(5);
  });
});

describe('multiplyMoney', () => {
  it('rounds to 3 decimal places', () => {
    expect(multiplyMoney(1.005, 3)).toBeCloseTo(3.015, 3);
  });
});

describe('parseMoney', () => {
  it('strips currency symbols and thousands separators', () => {
    expect(parseMoney('OMR 1,250.500')).toBe(1250.5);
  });

  it('returns 0 for empty or invalid input', () => {
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('not a number')).toBe(0);
  });
});

describe('formatOMR', () => {
  it('formats positive amounts with thousands separators and 3 decimals', () => {
    expect(formatOMR(1250)).toBe('OMR 1,250.000');
  });

  it('formats negative amounts with a leading minus before the prefix', () => {
    expect(formatOMR(-50)).toBe('-OMR 50.000');
  });

  it('falls back to zero for invalid input', () => {
    expect(formatOMR(null)).toBe('OMR 0.000');
    expect(formatOMR(undefined)).toBe('OMR 0.000');
  });
});

describe('formatNumber3Decimals', () => {
  it('formats without a currency prefix', () => {
    expect(formatNumber3Decimals(1250)).toBe('1,250.000');
  });
});

describe('formatPercent', () => {
  it('formats to 2 decimal places with a percent sign', () => {
    expect(formatPercent(24.5)).toBe('24.50%');
  });

  it('falls back to zero for invalid input', () => {
    expect(formatPercent(null)).toBe('0.00%');
  });
});
