// Shared Student-experience constants/helpers.
//
// This file exists so the Student Login form, StudentPage (Student Home),
// Student Explore (SearchPage in student mode) and the Student section of
// ProfilePage all agree on the same university list, city mapping and
// "what counts as student accommodation" rule instead of each inventing
// their own copy.
//
// IMPORTANT — no fake data: `properties.json` (see
// src/services/DATABASE-SCHEMA.md) has no `studentFriendly` /
// `accommodationType` / `propertyAudience` field yet, and this file does
// NOT invent one on the stored records. `isStudentAccommodation()` below is
// a pure, transparent function over fields that already exist on every
// real property (`type`, `rooms`, `rent`) — it classifies, it doesn't
// fabricate. If/when the schema grows a real `propertyAudience` field
// (landlords tagging their own listings as student accommodation), this
// function is the one place to update: prefer that explicit field when
// present, and keep the heuristic as a fallback for older listings.

export const STUDY_YEARS = ["1st year", "2nd year", "3rd year", "4th year", "Postgraduate"];

export const ACCOMMODATION_PREFERENCES = ["Any", "Single room", "Shared room", "Studio / Bachelor"];

// A curated, honest set of roommate lifestyle preferences a student can
// pick from when listing themselves as looking to share a property (see
// RoommateFinderPage.jsx's share-listing form). Kept as fixed tags rather
// than free text so cards/filters can show them consistently — but a
// student can still add anything else via the free-text "Important
// notes" field, which this deliberately does not try to replace.
export const PREFERENCE_TAGS = [
  "Clean",
  "Quiet",
  "Studious",
  "Social",
  "Early riser",
  "Night owl",
  "Non-smoker",
  "Pet-friendly",
];

// `type` values that actually exist in properties.json (see
// DATABASE-SCHEMA.md) and are realistically what a student on a budget,
// often sharing, is looking for — as opposed to a full family "House".
// This is a classification of real records, not invented per-property data.
export const STUDENT_PROPERTY_TYPES = new Set([
  "Back room",
  "Single room",
  "Room with Own Bathroom",
  "Bachelor Flat",
  "Studio",
  "Two-room unit",
  "Garden Flat",
  "Cottage",
]);

// A conservative budget ceiling used only as a fallback signal alongside
// `type` (a cheap "House" or "Flat" outlier shouldn't be excluded just
// because of its type label). Kept generous rather than tight, since the
// goal is "plausibly student-friendly", not a hard cutoff.
const STUDENT_BUDGET_CEILING = 260;

export function isStudentAccommodation(property) {
  if (!property) return false;
  // Prefer an explicit field if a future schema/landlord flow adds one —
  // see the file-level note above.
  if (property.propertyAudience) return property.propertyAudience === "student";
  if (property.accommodationType) return property.accommodationType === "student";

  const type = String(property.type || "");
  const rent = Number(property.rent) || 0;
  if (STUDENT_PROPERTY_TYPES.has(type)) return true;
  return rent > 0 && rent <= STUDENT_BUDGET_CEILING && Number(property.rooms) <= 2;
}

export function getStudentProperties(properties) {
  return (Array.isArray(properties) ? properties : []).filter(isStudentAccommodation);
}

// Whether a property can realistically be shared between students —
// drives the "Find a Roommate" action on property cards/detail (spec:
// "do not expose Find a Roommate on a property that clearly cannot
// accommodate another person"). Prefers an explicit `shareable` /
// `allowsRoommates` field if a future schema/landlord flow adds one
// (neither exists in properties.json today — see DATABASE-SCHEMA.md),
// falling back to the same "2+ rooms" heuristic Student Home's existing
// "Shareable homes only" filter already used before this change.
export function isShareableProperty(property) {
  if (!property) return false;
  if (typeof property.shareable === "boolean") return property.shareable;
  if (typeof property.allowsRoommates === "boolean") return property.allowsRoommates;
  return Number(property.rooms) >= 2;
}

// ---------------------------------------------------------------------
// Find a Roommate
// ---------------------------------------------------------------------
// Roommate discovery is database-backed through studentShareRequests.
// The page resolves each active request to the real student's stored profile
// and the real property referenced by propertyId. There is intentionally no
// hardcoded candidate directory here.

export function computeRoommateCompatibility(myProfile, candidate) {
  if (!myProfile || !candidate) return null;

  const checks = [];
  if (myProfile.university && candidate.university) {
    checks.push({ label: "Same university", match: myProfile.university === candidate.university });
  }
  if (myProfile.preferredArea && candidate.area) {
    checks.push({ label: "Preferred area", match: myProfile.preferredArea.toLowerCase() === String(candidate.area).toLowerCase() });
  }
  if (myProfile.accommodationPreference && myProfile.accommodationPreference !== "Any" && candidate.accommodationPreference) {
    checks.push({ label: "Accommodation type", match: myProfile.accommodationPreference === candidate.accommodationPreference });
  }
  const myBudget = Number(String(myProfile.budget || "").replace(/[^0-9.]/g, ""));
  const theirBudget = Number(String(candidate.budget || "").replace(/[^0-9.]/g, ""));
  if (Number.isFinite(myBudget) && myBudget > 0 && Number.isFinite(theirBudget) && theirBudget > 0) {
    checks.push({ label: "Budget range", match: Math.abs(myBudget - theirBudget) <= 40 });
  }
  if (myProfile.roommatePropertyId && candidate.propertyId != null) {
    checks.push({ label: "Same property", match: String(myProfile.roommatePropertyId) === String(candidate.propertyId) });
  }

  if (checks.length === 0) return null;
  const matched = checks.filter((c) => c.match).length;
  return {
    percent: Math.round((matched / checks.length) * 100),
    matched,
    total: checks.length,
    checks,
  };
}
