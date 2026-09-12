import { supabase } from '../../supabase';
import { newId } from '../../ids';
import { isObject } from '../shared/helpers';
import { requireCurrentUserId } from '../shared/identity';
import { withHashedCredentials } from '../session';
import { idbPut } from '../../../core/infrastructure/indexeddb';
import { enqueue } from '../../../core/sync/outbox';

// --- Registrations ---------------------------------------------------------
//
// schema v1 keeps one `registrations` table with a `kind` discriminator rather
// than the five near-identical tables the client used to query. The columns
// every wizard shares are real columns; everything wizard-specific (ID numbers,
// licence numbers, tax references) lives in the `submitted` JSONB.

const SHARED_REGISTRATION_FIELDS = new Set([
  'id', 'userId', 'user_id', 'kind', 'accountType',
  'legalName', 'legal_name', 'businessName', 'business_name',
  'phone', 'email', 'verificationStatus', 'verification_status',
  'createdAt', 'created_at', 'updatedAt', 'updated_at',
  'password', 'confirmPassword',
]);

function registrationToRow(record, { id, userId, kind }) {
  const submitted = {};
  for (const [key, value] of Object.entries(record)) {
    if (SHARED_REGISTRATION_FIELDS.has(key)) continue;
    // passwordHash is deliberately not written here — see the note on
    // credentials at the bottom of this file.
    if (key === 'passwordHash') continue;
    submitted[key] = value;
  }
  return {
    id,
    user_id: userId,
    kind,
    legal_name: record.legalName || record.fullName || null,
    business_name: record.businessName || record.companyName || record.agencyName || null,
    phone: record.phone || null,
    email: record.email || null,
    submitted,
    verification_status: record.verificationStatus || 'pending',
  };
}

export function rowToRegistration(row) {
  if (!isObject(row)) return null;
  const submitted = isObject(row.submitted) ? row.submitted : {};
  return {
    // `submitted` first so an explicit column always wins over a stale copy
    // of the same value that an older write may have left in the JSONB.
    ...submitted,
    id: row.id,
    userId: row.user_id,
    accountType: row.kind,
    kind: row.kind,
    legalName: row.legal_name || '',
    fullName: submitted.fullName || row.legal_name || '',
    businessName: row.business_name || '',
    companyName: submitted.companyName || row.business_name || '',
    agencyName: submitted.agencyName || row.business_name || '',
    phone: row.phone || '',
    email: row.email || '',
    verificationStatus: row.verification_status || 'pending',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function readRegistration(kind, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('kind', kind)
    .eq('user_id', String(userId))
    .maybeSingle();
  if (error) return null;
  return rowToRegistration(data);
}

export async function readRegistrations(kind, userId = null) {
  let query = supabase.from('registrations').select('*').eq('kind', kind);
  if (userId) query = query.eq('user_id', String(userId));
  const { data, error } = await query;
  if (error) return [];
  return (data || []).map(rowToRegistration).filter(Boolean);
}

// One registration per (user, kind) — the UNIQUE constraint in schema.sql is
// what enforces the app's "one hub per account" rule, so the upsert targets it.
export async function writeRegistration(kind, input, idPrefix) {
  // The authenticated Supabase user is the only source of identity. Never
  // trust a userId supplied by a form/component, and never fall back to a
  // synthetic id such as `local-user` because RLS correctly rejects it.
  const userId = requireCurrentUserId(input?.userId);
  const existing = await readRegistration(kind, userId);
  const id = existing?.id || newId(idPrefix);
  const record = await withHashedCredentials(
    { ...(existing || {}), ...input, verificationStatus: existing?.verificationStatus || 'pending' },
    existing
  );
  const row = registrationToRow(record, { id, userId, kind });
  const localRecord = { id, userId, row, kind, updatedAt: new Date().toISOString(), pendingSync: true };
  const localStoreByKind = { contractor: 'contractorRegistrations', landlord: 'landlordRegistrations', agent: 'agentRegistrations', company: 'companyRegistrations', pro: 'proRegistrations' };
  await idbPut(localStoreByKind[kind] || 'contractorRegistrations', kind === 'landlord' || kind === 'agent' || kind === 'company' || kind === 'pro' ? { userId, ...localRecord } : localRecord).catch(() => {});
  const gatewaySupported = ['landlord', 'agent', 'company', 'contractor'].includes(kind);
  if (gatewaySupported) {
    await enqueue('registration.upsert', { entityId: `${kind}:${userId}`, payload: { ...row, kind, userId }, dedupeKey: `registration:${kind}:${userId}` });
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return rowToRegistration({ ...row, created_at: existing?.createdAt || new Date().toISOString(), updated_at: new Date().toISOString() });

  // Credentials live in the server-only user_credentials table. The browser
  // can create/update its own credential during registration, but cannot read
  // the hash back. Authentication itself is handled by the Edge Function.
  if (record.username && record.passwordHash) {
    const { error: credentialError } = await supabase.rpc('save_business_credential', {
      p_username: String(record.username).trim(),
      p_password_hash: record.passwordHash,
    });
    if (credentialError) throw credentialError;
  }

  // With the Phase 12 gateway enabled, the queued mutation is the sole
  // authoritative registration write. Keeping the legacy direct write here
  // would create duplicate/conflicting writes and bypass the gateway audit.
  if (gatewaySupported && import.meta.env?.VITE_API_BASE_URL) {
    return rowToRegistration({ ...row, created_at: existing?.createdAt || new Date().toISOString(), updated_at: new Date().toISOString() });
  }

  // Save the registration itself in Supabase. The registrations table is the
  // source of truth for the wizard-specific fields.
  const { data, error } = await supabase
    .from('registrations')
    .upsert(row, { onConflict: 'user_id,kind' })
    .select();
  if (error) throw error;

  // A completed hub registration must also update the signed-in user's
  // account type. Without this, the registration exists in Supabase but the
  // rest of the app still sees the account as "general" after refresh.
  if (['landlord', 'agent', 'company', 'contractor'].includes(kind)) {
    const { error: userError } = await supabase
      .from('users')
      .update({
        account_type: kind,
        onboarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (userError) throw userError;
  }

  // Contractors are displayed from the dedicated contractors table, not
  // directly from registrations. Keep both records synchronized when the
  // contractor form is saved/edited.
  if (kind === 'contractor') {
    const services = Array.isArray(record.services) ? record.services : [];
    const areas = Array.isArray(record.areas)
      ? record.areas
      : (Array.isArray(record.serviceAreas) ? record.serviceAreas : []);

    const contractorId = String(
      existing?.contractorId ||
      record.contractorId ||
      newId('contractor')
    );

    const contractorRow = {
      id: contractorId,
      user_id: userId,
      business_name: record.businessName || record.fullName || 'Contractor',
      primary_trade: record.primaryTrade || record.trade || null,
      services,
      service_areas: areas,
      phone: record.phone || null,
      email: record.email || null,
      description: record.description || null,
      emergency: Boolean(record.emergencyService),
      free_quotes: Boolean(record.acceptsQuotes),
      verification: record.verificationStatus || 'pending',
      contact_name: record.fullName || record.contactName || null,
      city: record.city || null,
      area: record.area || areas[0] || null,
    };

    const { error: contractorError } = await supabase
      .from('contractors')
      .upsert(contractorRow, { onConflict: 'id' });
    if (contractorError) throw contractorError;

    // Keep the contractor id in submitted data so subsequent saves update
    // the same contractor instead of creating another contractor record.
    if (!record.contractorId) {
      const nextSubmitted = { ...(data?.[0]?.submitted || {}), contractorId };
      const { error: registrationError } = await supabase
        .from('registrations')
        .update({ submitted: nextSubmitted })
        .eq('id', id);
      if (registrationError) throw registrationError;
      if (data?.[0]) data[0].submitted = nextSubmitted;
    }
  }

  return rowToRegistration(data?.[0]);
}
