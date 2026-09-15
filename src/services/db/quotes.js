import { supabase } from '../supabase';
import { isObject } from './shared/helpers';
import { newId } from '../ids';
import { requireUser } from './shared/identity';

export async function createQuoteRequest(input) {
  const userId = requireUser();
  const record = {
    id: newId('quote'),
    user_id: userId,
    contractor_id: input.contractorId != null ? String(input.contractorId) : null,
    details: isObject(input.details)
      ? input.details
      : { note: String(input.details || ''), propertyId: input.propertyId || null },
    // 'pending' is not a value of the request_status enum.
    status: 'requested',
  };
  const { data, error } = await supabase.from('quote_requests').insert(record).select();
  if (error) throw error;
  return data?.[0];
}

export async function getQuoteRequests() {
  const { data, error } = await supabase.from('quote_requests').select('*');
  if (error) return [];
  return data || [];
}
