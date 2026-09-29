import { describe, it, expect } from 'vitest';
import { asRecord, optionalUuid, requireUuid, optionalString, optionalDate, optionalEnum, requireEnum } from './validation';

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
