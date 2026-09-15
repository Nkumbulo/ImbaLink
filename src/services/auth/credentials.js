/**
 * Password hashing for business-account credentials.
 *
 * Contractor / landlord / agent / company registrations each capture a
 * username + password during their wizard, and `localAuthProvider
 * .signInWithCredentials()` checks them at sign-in. Those passwords used to
 * be stored, and compared, in cleartext inside the registration record:
 *
 *     String(record.password) === password
 *
 * Anyone with devtools open could read every account's password out of
 * IndexedDB, and — because people reuse passwords — those are very likely
 * the same passwords protecting the person's email or mobile money. That
 * is worth fixing on the client even while auth is still local, because
 * this is also the shape the data will be in when it is first uploaded to a
 * server: whatever is stored here is what gets migrated.
 *
 * Scheme: PBKDF2-HMAC-SHA256, random 16-byte salt, iteration count stored
 * alongside the hash so it can be raised later without invalidating
 * existing records.
 *
 * A note on what this is and isn't. Client-side hashing is not a substitute
 * for a server: an attacker who controls the client can always skip the
 * check. What it does buy is that the stored artifact is no longer the
 * secret itself. When the real backend arrives, `verify()` moves server-side
 * unchanged — the record format below is deliberately the standard
 * `{algorithm, iterations, salt, hash}` shape a Node/Postgres implementation
 * would use, so stored hashes migrate as-is rather than forcing every
 * business account to reset their password.
 *
 * Two implementations, one output format:
 *   - WebCrypto (`crypto.subtle`) where available — fast, native.
 *   - A small pure-JS PBKDF2 otherwise. This is not paranoia: `crypto.subtle`
 *     is only exposed in secure contexts, so it is missing when the app is
 *     opened from a phone against a dev server over plain http on a LAN IP
 *     (http://192.168.x.x:5173) — a completely normal way to test this app.
 *     Without the fallback, registration on that device would either crash
 *     or silently keep storing cleartext.
 * Both compute the same function, so a hash produced by one verifies under
 * the other. Only the default iteration count differs (the JS path is far
 * slower, so it uses fewer); the count is read back from the record at
 * verification time, so records stay portable between the two.
 */

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const SUBTLE_ITERATIONS = 150_000;
const FALLBACK_ITERATIONS = 25_000;

// --- hex helpers -------------------------------------------------------

function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex) {
  const clean = String(hex || "");
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(out);
      return out;
    }
  } catch {
    // fall through
  }
  for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function utf8(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(String(text));
  // Minimal UTF-8 encoder for environments without TextEncoder.
  const str = unescape(encodeURIComponent(String(text)));
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

// --- pure-JS SHA-256 / HMAC / PBKDF2 ----------------------------------
// Straight implementation of FIPS 180-4 and RFC 2104/8018. Only reached
// when crypto.subtle is unavailable (see the header note).

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(message) {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLength = message.length * 8;
  const withPadding = new Uint8Array(((message.length + 9 + 63) >> 6) << 6);
  withPadding.set(message);
  withPadding[message.length] = 0x80;
  // Length is a 64-bit big-endian count of bits; JS bitwise ops are 32-bit,
  // so the high word is written with division rather than a shift.
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(withPadding.length - 4, bitLength >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < withPadding.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

function hmacSha256(key, message) {
  const blockSize = 64;
  let normalizedKey = key;
  if (normalizedKey.length > blockSize) normalizedKey = sha256(normalizedKey);

  const padded = new Uint8Array(blockSize);
  padded.set(normalizedKey);

  const inner = new Uint8Array(blockSize + message.length);
  const outer = new Uint8Array(blockSize + 32);
  for (let i = 0; i < blockSize; i++) {
    inner[i] = padded[i] ^ 0x36;
    outer[i] = padded[i] ^ 0x5c;
  }
  inner.set(message, blockSize);
  outer.set(sha256(inner), blockSize);
  return sha256(outer);
}

function pbkdf2Js(password, salt, iterations, keyLength) {
  const passwordBytes = utf8(password);
  const blocks = Math.ceil(keyLength / 32);
  const out = new Uint8Array(blocks * 32);

  for (let block = 1; block <= blocks; block++) {
    const saltWithIndex = new Uint8Array(salt.length + 4);
    saltWithIndex.set(salt);
    new DataView(saltWithIndex.buffer).setUint32(salt.length, block, false);

    let u = hmacSha256(passwordBytes, saltWithIndex);
    const accumulated = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(passwordBytes, u);
      for (let j = 0; j < accumulated.length; j++) accumulated[j] ^= u[j];
    }
    out.set(accumulated, (block - 1) * 32);
  }
  return out.slice(0, keyLength);
}

// --- derivation --------------------------------------------------------

function subtleAvailable() {
  try {
    return typeof crypto !== "undefined" && !!crypto.subtle && typeof crypto.subtle.importKey === "function";
  } catch {
    return false;
  }
}

async function derive(password, salt, iterations) {
  if (subtleAvailable()) {
    try {
      const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        key,
        HASH_BYTES * 8
      );
      return new Uint8Array(bits);
    } catch {
      // Fall through to the JS path rather than failing the sign-in.
    }
  }
  return pbkdf2Js(password, salt, iterations, HASH_BYTES);
}

// --- public API --------------------------------------------------------

/** True for a record produced by hashPassword(). */
export function isHashedCredential(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.algorithm === "pbkdf2-sha256" &&
    typeof value.hash === "string" &&
    typeof value.salt === "string" &&
    Number.isFinite(Number(value.iterations))
  );
}

/**
 * Hash a password for storage. Returns null for an empty password so
 * callers can store `passwordHash: null` rather than a hash of "".
 */
export async function hashPassword(password) {
  const text = String(password ?? "");
  if (!text) return null;
  const salt = randomBytes(SALT_BYTES);
  const iterations = subtleAvailable() ? SUBTLE_ITERATIONS : FALLBACK_ITERATIONS;
  const hash = await derive(text, salt, iterations);
  return {
    algorithm: "pbkdf2-sha256",
    iterations,
    salt: toHex(salt),
    hash: toHex(hash),
    createdAt: Date.now(),
  };
}

/**
 * Constant-time-ish comparison. JS can't promise true constant time, but
 * comparing every byte rather than bailing on the first mismatch removes
 * the trivially measurable early-exit signal.
 */
function equalHex(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a password against a stored hash record. Returns false (never
 * throws) for a malformed or missing record, so a corrupt row can't turn
 * into an exception in the sign-in path.
 */
export async function verifyPassword(password, stored) {
  if (!isHashedCredential(stored)) return false;
  const text = String(password ?? "");
  if (!text) return false;
  try {
    const derived = await derive(text, fromHex(stored.salt), Number(stored.iterations));
    return equalHex(toHex(derived), stored.hash);
  } catch {
    return false;
  }
}

/**
 * True when a stored hash was made with fewer iterations than this device
 * would use now — i.e. it was written by the JS fallback path and the
 * account has since been opened somewhere WebCrypto exists. Callers can
 * transparently re-hash on the next successful sign-in.
 */
export function needsRehash(stored) {
  if (!isHashedCredential(stored)) return true;
  const target = subtleAvailable() ? SUBTLE_ITERATIONS : FALLBACK_ITERATIONS;
  return Number(stored.iterations) < target;
}
