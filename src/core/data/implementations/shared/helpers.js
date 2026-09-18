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

export function normalizeStudentProfile(record) {
  if (!isObject(record)) return null;
  return {
    university: String(record.university || '').trim().slice(0, 120),
    studyYear: String(record.studyYear || '').trim().slice(0, 30),
    preferredCity: String(record.preferredCity || '').trim().slice(0, 60),
    preferredArea: String(record.preferredArea || '').trim().slice(0, 60),
    budget: String(record.budget || '').trim().slice(0, 30),
    accommodationPreference: String(record.accommodationPreference || 'Any').trim().slice(0, 40),
    wantsRoommate: Boolean(record.wantsRoommate),
    roommatesNeeded: String(record.roommatesNeeded || '').trim().slice(0, 20),
    lifestyleNotes: String(record.lifestyleNotes || '').trim().slice(0, 240),
    roommatePropertyId: record.roommatePropertyId != null ? String(record.roommatePropertyId) : '',
  };
}
