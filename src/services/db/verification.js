import { supabase } from '../supabase';
import { invalidatePropertyCache } from './properties/queries';
import { resetContractorCache } from './contractors';

// Moderation decisions are server-authorized by set_verification_status.
export async function setVerificationStatus(storeName, id, status, { note = '' } = {}) {
  const allowed = ['properties', 'registrations', 'contractors', 'student_profiles'];
  const allowedStatuses = ['unverified', 'pending', 'verified', 'rejected', 'flagged'];
  if (!allowed.includes(storeName) || !allowedStatuses.includes(status)) return null;

  const { data, error } = await supabase.rpc('set_verification_status', {
    p_store_name: storeName,
    p_id: String(id),
    p_status: status,
    p_note: String(note || '').slice(0, 500),
  });
  if (error) throw error;
  if (storeName === 'properties') invalidatePropertyCache();
  if (storeName === 'contractors') resetContractorCache();
  return data || null;
}
