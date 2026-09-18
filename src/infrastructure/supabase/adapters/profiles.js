import { supabase } from "../client";

const USER_COLUMNS =
  "id, email, phone, first_name, surname, display_name, avatar_url, account_type, created_at, updated_at";

async function readStudentRow(userId, { publicView = false } = {}) {
  const table = publicView ? "public_student_profiles" : "student_profiles";
  const { data, error } = await supabase
    .from(table)
    .select(publicView ? "*" : "user_id, verification_status, details")
    .eq("user_id", String(userId))
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export const supabaseProfileRepository = Object.freeze({
  async getProfile(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("users")
      .select(USER_COLUMNS)
      .eq("id", String(userId))
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const student = data.account_type === "student"
      ? await readStudentRow(userId)
      : null;
    return { user: data, student };
  },

  async getProfiles(ids = []) {
    const safeIds = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
    if (!safeIds.length) return [];
    const { data, error } = await supabase
      .from("public_user_profiles")
      .select("*")
      .in("id", safeIds);
    if (error) throw error;
    return data || [];
  },

  async getPublicProfile(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("public_user_profiles")
      .select("*")
      .eq("id", String(userId))
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const student = data.account_type === "student"
      ? await readStudentRow(userId, { publicView: true })
      : null;
    return { user: data, student };
  },

  async updateProfile(userId, patch, studentProfile = null) {
    if (!userId) throw new TypeError("ProfileRepository.updateProfile requires userId.");
    const { data, error } = await supabase
      .from("users")
      .update(patch || {})
      .eq("id", String(userId))
      .select(USER_COLUMNS)
      .maybeSingle();
    if (error) throw error;

    if (studentProfile) {
      const { error: studentError } = await supabase
        .from("student_profiles")
        .upsert(studentProfile, { onConflict: "user_id" });
      if (studentError) throw studentError;
    }

    return data || null;
  },

  async upsertProfile(userId, row, studentProfile = null) {
    if (!userId) throw new TypeError("ProfileRepository.upsertProfile requires userId.");
    const { data, error } = await supabase
      .from("users")
      .upsert({ ...(row || {}), id: String(userId) }, { onConflict: "id" })
      .select(USER_COLUMNS)
      .maybeSingle();
    if (error) throw error;

    if (studentProfile) {
      const { error: studentError } = await supabase
        .from("student_profiles")
        .upsert(studentProfile, { onConflict: "user_id" });
      if (studentError) throw studentError;
    }

    return data || null;
  },
});
