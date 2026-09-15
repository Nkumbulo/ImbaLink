/**
 * Stable identifier generation.
 *
 * Every record this app creates locally gets an id from here. Before this
 * module each create path minted its own (`land-list-${Date.now()}-${rand}`,
 * `land-${Date.now()}`, `agent-${Date.now()}`, ...), which had two problems
 * once a server is involved:
 *
 *   1. `${Date.now()}` alone is not unique. Two registrations created in the
 *      same millisecond (two tabs, a double-tap, a retry) produced the same
 *      id and the second silently overwrote the first.
 *   2. The server can't accept a client-minted id it can't trust to be
 *      globally unique, so ids would have to be re-issued on upload — which
 *      means every local reference to that record (a like keyed
 *      `${userId}::${itemId}`, a message thread keyed by property id) would
 *      have to be rewritten at sync time.
 *
 * A UUIDv4 fixes both: it is unique without coordination, so the id a record
 * is created with offline is the same id it keeps on the server forever. The
 * `prefix` is kept purely for human readability when reading raw records in
 * the database inspector — the server should treat the whole string as an
 * opaque key.
 *
 * EXISTING RECORDS ARE NOT RE-KEYED. Anything already in a browser keeps the
 * id it was created with; only new records use this. Both shapes are plain
 * strings, and every comparison in the app already goes through
 * `String(a) === String(b)`, so the two coexist safely.
 */

/**
 * RFC 4122 v4 UUID. Uses the platform generator where available and falls
 * back to `crypto.getRandomValues` (still cryptographically random), and
 * only then to `Math.random` — which is not unique-by-guarantee but is
 * better than failing to create the record at all. The fallback chain
 * matters: `crypto.randomUUID` is only exposed in secure contexts, so a
 * phone hitting a dev server over plain http on a LAN IP lands on step 2.
 */
export function uuid() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Some embedded webviews expose `crypto` but throw on `randomUUID`.
  }

  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // fall through
  }

  const rand = () => Math.random().toString(16).slice(2, 10).padStart(8, "0");
  return `${rand()}-${rand().slice(0, 4)}-4${rand().slice(0, 3)}-a${rand().slice(0, 3)}-${rand()}${rand().slice(0, 4)}`;
}

/**
 * A prefixed id, e.g. newId("listing") -> "listing_9f2c...".
 * The separator is `_` rather than `-` so the prefix stays visually distinct
 * from the UUID's own hyphens when scanning raw records.
 */
export function newId(prefix) {
  const clean = String(prefix || "rec").replace(/[^a-z0-9]/gi, "").toLowerCase() || "rec";
  return `${clean}_${uuid()}`;
}
