let counter = 0;

/**
 * Deterministic-enough unique reference generator for AI-initiated
 * transaction documents/journal entries — the same technique
 * (timestamp + monotonic counter + random suffix) as
 * src/services/accountingService.ts's own generateUniqueRef(), duplicated
 * here (not imported) because that file is a browser-only module (its
 * default export constructs a client-side singleton against
 * getSupabaseClient()) that must never be pulled into the server bundle.
 * This is a 3-line id-formatting helper, not business logic — porting the
 * same trivial algorithm carries none of the "competing implementation"
 * risk section 10 warns about; the actual business logic (permission
 * checks, balance adjustments, VAT math) all still runs inside the existing
 * create_direct_expense Postgres RPC, never reimplemented here.
 */
export function generateAiActionRef(prefix: string): string {
  counter += 1;
  const time = Date.now();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-AI-${time}-${counter}-${rand}`;
}
