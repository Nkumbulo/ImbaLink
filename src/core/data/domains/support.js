import { supabase } from '../../supabase/client';

export async function submitSupportRequest({ category, message, contact, kind = 'problem', pageContext = null }) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('support_requests').insert({
    user_id: auth?.user?.id || null,
    kind,
    category,
    message,
    contact: contact || null,
    page_context: pageContext,
    metadata: typeof navigator !== 'undefined' ? { userAgent: navigator.userAgent } : {},
  });
  if (error) throw error;
}
