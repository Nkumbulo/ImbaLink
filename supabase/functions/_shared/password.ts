const HASH_BYTES = 32;

function fromHex(hex: string): Uint8Array {
  const clean = String(hex || "");
  if (!clean || clean.length % 2) throw new Error("INVALID_HASH");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const value = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(value)) throw new Error("INVALID_HASH");
    out[i] = value;
  }
  return out;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(String(value));
}

export function isHashedCredential(value: unknown): value is {
  algorithm: string; iterations: number; salt: string; hash: string;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.algorithm === "pbkdf2-sha256" &&
    typeof v.salt === "string" && typeof v.hash === "string" &&
    Number.isInteger(Number(v.iterations)) && Number(v.iterations) > 0;
}

export async function verifyPassword(password: string, stored: unknown): Promise<boolean> {
  if (!isHashedCredential(stored) || !password) return false;
  try {
    const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: fromHex(stored.salt), iterations: Number(stored.iterations), hash: "SHA-256" },
      key,
      HASH_BYTES * 8,
    ));
    const expected = fromHex(stored.hash);
    if (derived.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
  const iterations = 150_000;
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, HASH_BYTES * 8,
  ));
  const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return { algorithm: "pbkdf2-sha256", iterations, salt: hex(salt), hash: hex(derived), createdAt: Date.now() };
}

export function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase();
}

export function virtualEmail(username: string) {
  const safe = normalizeUsername(username).replace(/[^a-z0-9._-]/g, "-");
  return `${safe}@auth.imbalink.local`;
}
