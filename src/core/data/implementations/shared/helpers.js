// Pure, dependency-free helpers used across the data layer. Nothing here
// touches Supabase, module state, or any other db/ module — safe to import
// from anywhere without creating a circular dependency.

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function now() {
  return Date.now();
}

export function toId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : String(value);
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

// phone_normalized is UNIQUE. Two accounts without a phone number would both
// want to store '', and the second insert would fail on the constraint, so
// "no phone" has to be NULL.
export function phoneKeyOrNull(value) {
  const digits = normalizePhone(value);
  return digits || null;
}

export function isoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// move_in_date is a DATE column: '' is not a date and Postgres rejects it.
export function dateOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function intOr(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
