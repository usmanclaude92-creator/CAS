import { describe, it, expect } from 'vitest';
import { parsePagination, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination';

describe('parsePagination', () => {
  it('defaults limit/offset when nothing is provided', () => {
    expect(parsePagination({})).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
    expect(parsePagination(undefined)).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
  });

  it('honors a valid limit/offset within bounds', () => {
    expect(parsePagination({ limit: 5, offset: 10 })).toEqual({ limit: 5, offset: 10 });
  });

  it('clamps a limit above MAX_PAGE_SIZE — this is the guard against an unbounded AI query', () => {
    expect(parsePagination({ limit: 100000 })).toEqual({ limit: MAX_PAGE_SIZE, offset: 0 });
  });

  it('falls back to the default for a zero/negative/non-numeric limit', () => {
    expect(parsePagination({ limit: 0 }).limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagination({ limit: -5 }).limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagination({ limit: 'all' }).limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagination({ limit: null }).limit).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back to offset 0 for a negative/non-numeric offset', () => {
    expect(parsePagination({ offset: -1 }).offset).toBe(0);
    expect(parsePagination({ offset: 'x' }).offset).toBe(0);
  });

  it('floors a fractional limit/offset', () => {
    expect(parsePagination({ limit: 5.9, offset: 2.9 })).toEqual({ limit: 5, offset: 2 });
  });
});
