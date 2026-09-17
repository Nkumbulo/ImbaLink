// Shared by supabaseMessagingProvider.js (the class shell) and its mixins
// in this folder. Kept as its own tiny module specifically so the mixins
// can import these without creating a circular import with the shell file
// (which itself imports the mixins to build the class) — both sides
// import this instead of one importing the other.
export const MESSAGE_DISPLAY_LIMIT = 100;

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
