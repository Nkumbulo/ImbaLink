import { supabase } from "../client";

/** Supabase-backed storage port. */
export const supabaseStorage = Object.freeze({
  async upload(bucket, path, file, options = {}) {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, options);
    if (error) throw error;
    return data;
  },

  async remove(bucket, paths) {
    const { data, error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
    return data;
  },

  getUrl(bucket, path) {
    const { data, error } = supabase.storage.from(bucket).getPublicUrl(path);
    if (error) throw error;
    return data?.publicUrl || null;
  },
});
