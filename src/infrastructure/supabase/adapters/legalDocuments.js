import { supabase } from "../client";

export async function getPublishedLegalDocument(slug) {
  const key = String(slug || "").trim();
  if (!key) return null;

  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, slug, title, version, effective_date, content, updated_at")
    .eq("slug", key)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export const supabaseLegalDocumentRepository = Object.freeze({
  getPublishedLegalDocument,
});
