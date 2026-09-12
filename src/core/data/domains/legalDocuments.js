import { supabase } from '../../supabase/client';

export async function getPublishedLegalDocument(slug) {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('id, slug, title, version, effective_date, content, updated_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
