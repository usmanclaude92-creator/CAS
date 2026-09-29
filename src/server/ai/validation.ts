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

