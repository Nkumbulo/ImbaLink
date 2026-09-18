/** @deprecated Compatibility adapter. Prefer backend.supportRepository. */
import { supabase } from '../../../services/supabase.js';
import { createSupportService } from '../implementations/support/support';

const service = createSupportService({
  getCurrentUser: () => supabase.auth.getUser().then(({ data }) => data),
  insertRequest: async (payload) => {
    const { error } = await supabase.from('support_requests').insert(payload);
    if (error) throw error;
  },
});

export const { submitSupportRequest } = service;
