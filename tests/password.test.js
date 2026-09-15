import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  isHashedCredential,
  normalizeUsername,
  virtualEmail,
} from '../supabase/functions/_shared/password.ts';

// The business-auth Edge Function itself (supabase/functions/business-auth/index.ts)
// can't be unit-tested here: it imports the Deno-flavored "npm:@supabase/supabase-js@2"
// specifier and calls Deno.serve/Deno.env at module load, neither of which run under
// Node/Vitest — it needs a real Deno runtime or a live Supabase project to exercise
// end-to-end (login, session issuance, forged-session rejection). But the actual
// password verification it depends on lives in this shared module, which has zero
// Deno-only or Supabase-client dependencies (just Web Crypto, available in Node too),
// so it genuinely can be tested directly rather than left as an untestable gap.
// This is P14's auth coverage for the cryptographic core; the request-handling and
// session-issuance parts of business-auth/index.ts remain unverified by any test.

describe('password hashing/verification (business-auth core logic)', () => {
  it('produces a hash verifiable with the original password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(isHashedCredential(stored)).toBe(true);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password against a real hash', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password', stored)).toBe(false);
  });

  it('salts every hash differently, even for the identical password', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // Each still verifies correctly against its own stored hash.
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('never throws on a malformed or missing stored value — fails closed instead', async () => {
    await expect(verifyPassword('anything', null)).resolves.toBe(false);
    await expect(verifyPassword('anything', undefined)).resolves.toBe(false);
    await expect(verifyPassword('anything', {})).resolves.toBe(false);
    await expect(verifyPassword('anything', { algorithm: 'pbkdf2-sha256', salt: 'not-hex!!', hash: 'zz', iterations: 1 })).resolves.toBe(false);
    await expect(verifyPassword('', await hashPassword('x'))).resolves.toBe(false);
  });

  it('isHashedCredential correctly distinguishes a real hash shape from plaintext/legacy shapes', async () => {
    const realHash = await hashPassword('x');
    expect(isHashedCredential(realHash)).toBe(true);
    expect(isHashedCredential('plaintext-password')).toBe(false);
    expect(isHashedCredential({ password: 'plaintext' })).toBe(false);
    expect(isHashedCredential({ algorithm: 'md5', salt: 'a', hash: 'b', iterations: 1 })).toBe(false);
    expect(isHashedCredential({ algorithm: 'pbkdf2-sha256', salt: 'a', hash: 'b', iterations: 0 })).toBe(false);
  });

  it('normalizeUsername trims and lowercases', () => {
    expect(normalizeUsername('  Mitchell.Landlord  ')).toBe('mitchell.landlord');
    expect(normalizeUsername('')).toBe('');
    expect(normalizeUsername(null)).toBe('');
  });

  it('virtualEmail produces a stable, sanitized synthetic address', () => {
    expect(virtualEmail('Mitchell Landlord!')).toBe('mitchell-landlord-@auth.imbalink.local');
    expect(virtualEmail('plain.user_1')).toBe('plain.user_1@auth.imbalink.local');
  });
});
