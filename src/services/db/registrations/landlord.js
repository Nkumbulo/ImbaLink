import { supabase } from '../../supabase';
import { newId } from '../../ids';
import { activeUserKey, requireUser } from '../shared/identity';
import { readRegistration, readRegistrations, writeRegistration } from './shared';

export async function registerLandlord(input) {
  return writeRegistration('landlord', input, 'landlordreg');
}

export async function getLandlordRegistration(userId = activeUserKey()) {
  return readRegistration('landlord', userId);
}

export async function getLandlordVerification(userId = activeUserKey()) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('landlord_verifications')
    .select('id, user_id, phone, id_image_path, verification_status, submitted_at, reviewed_at, review_note, created_at, updated_at')
    .eq('user_id', String(userId))
    .maybeSingle();
  if (error) {
    // A migration may not have been run yet. Keep the hub usable and let the
    // UI show an actionable error when a submission is attempted.
    if (error.code !== 'PGRST205') console.warn('Landlord verification read failed:', error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    phone: data.phone || '',
    idImagePath: data.id_image_path || '',
    verificationStatus: ['pending', 'verified', 'rejected'].includes(data.verification_status)
      ? data.verification_status : 'pending',
    submittedAt: data.submitted_at || null,
    reviewedAt: data.reviewed_at || null,
    reviewNote: data.review_note || '',
    createdAt: data.created_at || null,
    updatedAt: data.updated_at || null,
  };
}

export async function submitLandlordVerification({ phone, file } = {}) {
  const userId = requireUser();
  const cleanPhone = String(phone || '').trim();
  const digits = cleanPhone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    throw new Error('Enter a valid phone number.');
  }
  if (!(file instanceof File)) throw new Error('Please choose an ID image.');
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) throw new Error('ID image must be JPG, PNG or WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('ID image must be 5MB or smaller.');

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/id-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('identity-documents')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '3600',
    });
  if (uploadError) throw uploadError;

  const existing = await getLandlordVerification(userId);
  const id = existing?.id || newId('landlordverify');
  const row = {
    id,
    user_id: userId,
    phone: cleanPhone,
    id_image_path: path,
    verification_status: 'pending',
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    review_note: null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('landlord_verifications')
    .upsert(row, { onConflict: 'user_id' })
    .select('id, user_id, phone, id_image_path, verification_status, submitted_at, reviewed_at, review_note, created_at, updated_at')
    .single();
  if (error) {
    // Do not leave an orphaned private ID document when the database write fails.
    await supabase.storage.from('identity-documents').remove([path]).catch(() => {});
    throw error;
  }
  return {
    id: data.id,
    userId: data.user_id,
    phone: data.phone || '',
    idImagePath: data.id_image_path || '',
    verificationStatus: data.verification_status || 'pending',
    submittedAt: data.submitted_at || null,
    reviewedAt: data.reviewed_at || null,
    reviewNote: data.review_note || '',
    createdAt: data.created_at || null,
    updatedAt: data.updated_at || null,
  };
}

export async function getAllLandlordRegistrations() {
  return readRegistrations('landlord');
}
