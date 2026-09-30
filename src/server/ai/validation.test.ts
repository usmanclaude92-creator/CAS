import { describe, it, expect } from 'vitest';
import { asRecord, optionalUuid, requireUuid, optionalString, optionalDate, optionalEnum, requireEnum, requireString, requireDate, requireAmount } from './validation';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('asRecord', () => {
  it('returns the object as-is when given a plain object', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });
  it('returns an empty object for null/undefined/array/primitive input', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord(undefined)).toEqual({});
    expect(asRecord([1, 2, 3])).toEqual({});
    expect(asRecord('hello')).toEqual({});
    expect(asRecord(42)).toEqual({});
  });
});

describe('requireUuid', () => {
  it('accepts a valid UUID', () => {
    expect(requireUuid(VALID_UUID, 'id')).toEqual({ ok: true, value: VALID_UUID });
  });
  it('rejects a missing value', () => {
    const result = requireUuid(undefined, 'id');
    expect(result.ok).toBe(false);
  });
  it('rejects a non-UUID string — this is the guard against a caller passing a table/column name or arbitrary string where an id is expected', () => {
    const result = requireUuid('not-a-uuid', 'id');
    expect(result.ok).toBe(false);
  });
  it('rejects a non-string value', () => {
    expect(requireUuid(12345, 'id').ok).toBe(false);
    expect(requireUuid({ nested: true }, 'id').ok).toBe(false);
  });
});

describe('optionalUuid', () => {
  it('treats undefined/null/empty-string as "not provided" (ok, value undefined)', () => {
    expect(optionalUuid(undefined, 'id')).toEqual({ ok: true, value: undefined });
    expect(optionalUuid(null, 'id')).toEqual({ ok: true, value: undefined });
    expect(optionalUuid('', 'id')).toEqual({ ok: true, value: undefined });
  });
  it('accepts a valid UUID when provided', () => {
    expect(optionalUuid(VALID_UUID, 'id')).toEqual({ ok: true, value: VALID_UUID });
  });
  it('rejects an invalid UUID when provided', () => {
    expect(optionalUuid('xyz', 'id').ok).toBe(false);
  });
});

describe('optionalString', () => {
  it('accepts a string within the max length', () => {
    expect(optionalString('hello', 'search', 10)).toEqual({ ok: true, value: 'hello' });
  });
  it('rejects a string over the max length — bounds an unbounded ilike() pattern from reaching the query', () => {
    expect(optionalString('x'.repeat(300), 'search', 200).ok).toBe(false);
  });
  it('rejects a non-string value', () => {
    expect(optionalString(123, 'search').ok).toBe(false);
    expect(optionalString({}, 'search').ok).toBe(false);
  });
});

describe('optionalDate', () => {
  it('accepts a well-formed ISO date', () => {
    expect(optionalDate('2026-01-15', 'fromDate')).toEqual({ ok: true, value: '2026-01-15' });
  });
  it('rejects a malformed date string', () => {
    expect(optionalDate('15-01-2026', 'fromDate').ok).toBe(false);
    expect(optionalDate('not a date', 'fromDate').ok).toBe(false);
    expect(optionalDate('2026-13-45', 'fromDate').ok).toBe(false);
  });
});

describe('optionalEnum / requireEnum', () => {
  const STATUSES = ['draft', 'posted'] as const;

  it('accepts a value in the allowed set', () => {
    expect(optionalEnum('posted', 'status', STATUSES)).toEqual({ ok: true, value: 'posted' });
    expect(requireEnum('posted', 'status', STATUSES)).toEqual({ ok: true, value: 'posted' });
  });
  it('rejects a value outside the allowed set — this is what stops a caller-supplied argument from reaching an .eq() filter with an arbitrary, unvalidated value', () => {
    expect(optionalEnum('reversed_by_hand', 'status', STATUSES).ok).toBe(false);
    expect(requireEnum('anything', 'direction', STATUSES).ok).toBe(false);
  });
  it('requireEnum rejects a missing value; optionalEnum accepts it as unset', () => {
    expect(requireEnum(undefined, 'direction', STATUSES).ok).toBe(false);
    expect(optionalEnum(undefined, 'status', STATUSES)).toEqual({ ok: true, value: undefined });
  });
});

describe('requireString', () => {
  it('accepts and trims a non-empty string within the max length', () => {
    expect(requireString('  hello  ', 'title', 50)).toEqual({ ok: true, value: 'hello' });
  });
  it('rejects an empty/whitespace-only string', () => {
    expect(requireString('', 'title').ok).toBe(false);
    expect(requireString('   ', 'title').ok).toBe(false);
  });
  it('rejects a missing value', () => {
    expect(requireString(undefined, 'title').ok).toBe(false);
    expect(requireString(null, 'title').ok).toBe(false);
  });
  it('rejects a string over the max length', () => {
    expect(requireString('x'.repeat(300), 'title', 200).ok).toBe(false);
  });
  it('rejects a non-string value', () => {
    expect(requireString(123, 'title').ok).toBe(false);
  });
});

describe('requireDate', () => {
  it('accepts a well-formed ISO date', () => {
    expect(requireDate('2026-01-15', 'expenseDate')).toEqual({ ok: true, value: '2026-01-15' });
  });
  it('rejects a missing or malformed date', () => {
    expect(requireDate(undefined, 'expenseDate').ok).toBe(false);
    expect(requireDate('15-01-2026', 'expenseDate').ok).toBe(false);
    expect(requireDate('not a date', 'expenseDate').ok).toBe(false);
  });
});

describe('requireAmount — Phase 5 financial-action precision guard', () => {
  it('accepts a positive amount with up to 3 decimal places', () => {
    expect(requireAmount(250, 'amount')).toEqual({ ok: true, value: 250 });
    expect(requireAmount(250.5, 'amount')).toEqual({ ok: true, value: 250.5 });
    expect(requireAmount(250.125, 'amount')).toEqual({ ok: true, value: 250.125 });
  });
  it('rejects a value with more than 3 decimal places — never silently rounds a financial figure', () => {
    expect(requireAmount(250.1234, 'amount').ok).toBe(false);
    expect(requireAmount(0.0001, 'amount').ok).toBe(false);
  });
  it('rejects a floating-point-noise value as valid (0.1 + 0.2 style artifacts must not falsely reject)', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in JS — must still be accepted as "2 decimal places" for a real 0.30 amount.
    expect(requireAmount(0.1 + 0.2, 'amount').ok).toBe(true);
  });
  it('rejects zero, negative, non-finite, and non-numeric values', () => {
    expect(requireAmount(0, 'amount').ok).toBe(false);
    expect(requireAmount(-50, 'amount').ok).toBe(false);
    expect(requireAmount(Infinity, 'amount').ok).toBe(false);
    expect(requireAmount(NaN, 'amount').ok).toBe(false);
    expect(requireAmount('250', 'amount').ok).toBe(false); // a numeric-looking string is still rejected — never trust implicit coercion for money
    expect(requireAmount(undefined, 'amount').ok).toBe(false);
  });
  it('rejects an amount above the configured max — never lets an unbounded figure through', () => {
    expect(requireAmount(2_000_000, 'amount', { max: 1_000_000 }).ok).toBe(false);
    expect(requireAmount(1_000_000, 'amount', { max: 1_000_000 })).toEqual({ ok: true, value: 1_000_000 });
  });
});
