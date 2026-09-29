export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  limit: number;
  offset: number;
}

/**
 * Clamps caller-supplied pagination to a safe, bounded range. Never let an
 * AI tool call request an unbounded result set — the model can always ask
 * again with a higher offset if it genuinely needs more.
 */
export function parsePagination(raw: unknown): Pagination {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawLimit = Number(obj.limit);
  const rawOffset = Number(obj.offset);

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}
