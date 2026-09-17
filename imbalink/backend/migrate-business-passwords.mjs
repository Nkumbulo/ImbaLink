#!/usr/bin/env node
/**
 * One-shot/cron-safe migration for legacy business credentials.
 *
 * Required environment:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run this before enabling username/password production sign-in. It never
 * prints or logs plaintext passwords. Re-running is safe because cleaned
 * registrations no longer contain `submitted.password`.
 */
import { createClient } from '@supabase/supabase-js';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}
function hashPassword(password) {
  const salt = randomBytes(16);
  const iterations = 150_000;
  const hash = pbkdf2Sync(String(password), salt, iterations, 32, 'sha256');
  return {
    algorithm: 'pbkdf2-sha256',
    iterations,
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
    createdAt: Date.now(),
  };
}
function isHash(value) {
  return value && value.algorithm === 'pbkdf2-sha256' && Number(value.iterations) > 0 &&
    typeof value.salt === 'string' && typeof value.hash === 'string';
}
function virtualEmail(username) {
  return `${normalizeUsername(username).replace(/[^a-z0-9._-]/g, '-') }@auth.imbalink.local`;
}

const { data: rows, error } = await supabase.from('registrations').select('id,user_id,submitted');
if (error) throw error;
let migrated = 0, skipped = 0, failed = 0;

for (const row of rows || []) {
  const submitted = { ...(row.submitted || {}) };
  const username = normalizeUsername(submitted.username);
  const plaintext = typeof submitted.password === 'string' ? submitted.password : '';
  const existingHash = submitted.passwordHash;
  if (!username || (!plaintext && !isHash(existingHash))) { skipped++; continue; }

  try {
    const passwordHash = isHash(existingHash) ? existingHash : hashPassword(plaintext);
    const { error: credentialError } = await supabase.from('user_credentials').upsert({
      user_id: row.user_id,
      username,
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (credentialError) throw credentialError;

    if (plaintext) {
      const { data: authData, error: authLookupError } = await supabase.auth.admin.getUserById(String(row.user_id));
      if (authLookupError) throw authLookupError;
      if (!authData?.user) throw new Error('AUTH_USER_NOT_FOUND');
      const patch = { password: plaintext, email_confirm: true };
      if (!authData.user.email) patch.email = virtualEmail(username);
      const { error: authError } = await supabase.auth.admin.updateUserById(String(row.user_id), patch);
      if (authError) throw authError;
    }

    delete submitted.password;
    delete submitted.confirmPassword;
    delete submitted.passwordHash;
    const { error: cleanError } = await supabase.from('registrations')
      .update({ submitted, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (cleanError) throw cleanError;
    migrated++;
  } catch (error) {
    console.error(`Migration failed for registration ${row.id}:`, error.message || error);
    failed++;
  }
}

console.log(JSON.stringify({ scanned: rows?.length || 0, migrated, skipped, failed }));
