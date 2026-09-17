/** Canonical contractor quote-request operations. */
import { isObject } from '../shared/helpers';

export function createQuoteService({ supabase, requireUser, newId }) {
  async function createQuoteRequest(input) {
    const userId = requireUser();
    const record = {
      id: newId('quote'), user_id: userId,
      contractor_id: input.contractorId != null ? String(input.contractorId) : null,
      details: isObject(input.details) ? input.details : { note: String(input.details || ''), propertyId: input.propertyId || null },
      status: 'requested',
    };
    const { data, error } = await supabase.from('quote_requests').insert(record).select();
    if (error) throw error;
    return data?.[0];
  }

  async function getQuoteRequests() {
    const { data, error } = await supabase.from('quote_requests').select('*');
    if (error) return [];
    return data || [];
  }

  return { createQuoteRequest, getQuoteRequests };
}
//: quote workflow moved behind the Core data boundary.
