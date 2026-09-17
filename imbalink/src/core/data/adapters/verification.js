/** Infrastructure adapter: canonical verification persistence boundary. */
import { supabase } from '../../../services/supabase.js';
import { invalidatePropertyCache } from './properties.js';
import { resetContractorCache } from '../domains/interactions.js';
import { createVerificationService } from '../implementations/verification/verification.js';

const setStatus = async ({ storeName, id, status, note }) => {
  const { data, error } = await supabase.rpc('set_verification_status', {
    p_store_name: storeName,
    p_id: id,
    p_status: status,
    p_note: note,
  });
  if (error) throw error;
  return data;
};

const service = createVerificationService({ setStatus, invalidatePropertyCache, resetContractorCache });
export const { setVerificationStatus } = service;
