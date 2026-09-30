/**
 * Minimal, dependency-free argument validation. This project has no
 * zod/yup/joi/ajv dependency (confirmed in docs/ai/CAS-AI-PHASE-0-AUDIT.md
 * research) — per the Phase 1 directive not to introduce a new validation
 * framework "unnecessarily," these hand-written guards cover the small,
 * fixed shapes Phase 1's tools actually need. Revisit only if the tool
 * surface grows enough that this becomes unwieldy.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function optionalUuid(value: unknown, field: string): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    return { ok: false, error: `"${field}" must be a valid UUID if provided.` };
  }
  return { ok: true, value };
}

export function requireUuid(value: unknown, field: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    return { ok: false, error: `"${field}" is required and must be a valid UUID.` };
  }
  return { ok: true, value };
}

export function optionalString(value: unknown, field: string, maxLength = 255): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
  if (typeof value !== 'string' || value.length > maxLength) {
    return { ok: false, error: `"${field}" must be a string of at most ${maxLength} characters.` };
  }
  return { ok: true, value };
}

export function optionalDate(value: unknown, field: string): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    return { ok: false, error: `"${field}" must be an ISO date (YYYY-MM-DD) if provided.` };
  }
  return { ok: true, value };
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): { ok: true; value: T | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return { ok: false, error: `"${field}" must be one of: ${allowed.join(', ')}.` };
  }
  return { ok: true, value: value as T };
}

export function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): { ok: true; value: T } | { ok: false; error: string } {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return { ok: false, error: `"${field}" is required and must be one of: ${allowed.join(', ')}.` };
  }
  return { ok: true, value: value as T };
}

export function requireString(value: unknown, field: string, maxLength = 255): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    return { ok: false, error: `"${field}" is required and must be a non-empty string of at most ${maxLength} characters.` };
  }
  return { ok: true, value: value.trim() };
}

export function requireDate(value: unknown, field: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    return { ok: false, error: `"${field}" is required and must be an ISO date (YYYY-MM-DD).` };
  }
  return { ok: true, value };
}

/**
 * Phase 5 action tools only (src/server/ai/actions/**) — a positive,
 * OMR-3-decimal-precision-bounded monetary amount. Never trusts a value
 * with more than 3 decimal places (a 4th digit can't be represented in this
 * currency and must be rejected, not silently rounded, so the model never
 * gets to pick which way a financial value rounds). Uses the same
 * scaled-integer technique as utils/formatters.ts's addMoney/parseMoney —
 * not a new precision strategy, the same one already established.
 */
export function requireAmount(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number } = {}
): { ok: true; value: number } | { ok: false; error: string } {
  const min = opts.min ?? 0.001;
  const max = opts.max ?? 1_000_000_000;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: `"${field}" is required and must be a positive number.` };
  }
  if (value < min || value > max) {
    return { ok: false, error: `"${field}" must be between ${min} and ${max}.` };
  }
  const scaled = Math.round(value * 1000);
  if (Math.abs(scaled - value * 1000) > 1e-6) {
    return { ok: false, error: `"${field}" must have at most 3 decimal places (OMR precision).` };
  }
  return { ok: true, value: scaled / 1000 };
}

