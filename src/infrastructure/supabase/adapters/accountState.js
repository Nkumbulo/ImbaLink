import { supabase } from "../client";
import { supabaseProfileRepository } from "./profiles";
import { activeUserKey } from "../../../core/data/implementations/shared/identity";
import { isObject } from "../../../core/data/implementations/shared/helpers";
import { newId } from "../../../services/ids";
const MESSAGE_DISPLAY_LIMIT = 100;

const rowToLegacyMessage = (row, currentUserId) => ({
  id: row.id,
  from: row.sender_user_id === currentUserId ? "me" : "them",
  text: row.body,
  ts: new Date(row.sent_at).getTime(),
});

const rowToProfile = (row, studentRow = null) => {
  if (!row) return null;
  const isStudent = row.account_type === "student";
  const details = studentRow?.details && typeof studentRow.details === "object" ? studentRow.details : {};
  return {
    id: String(row.id),
    firstName: String(row.first_name || "").trim(),
    surname: String(row.surname || "").trim(),
    phone: String(row.phone || "").trim(),
    name: String(row.display_name || `${row.first_name || ""} ${row.surname || ""}`).trim(),
    email: row.email || "",
    avatarUrl: row.avatar_url || "",
    createdAt: row.created_at || Date.now(),
    updatedAt: row.updated_at || Date.now(),
    accountType: ["general", "student", "landlord", "agent", "company", "contractor"].includes(row.account_type) ? row.account_type : null,
    studentProfile: isStudent ? details : null,
    studentVerificationStatus: isStudent ? (['unverified', 'pending', 'verified', 'rejected'].includes(studentRow?.verification_status) ? studentRow.verification_status : 'unverified') : null,
  };
};

const emptyState = (userId) => ({
  profile: { id: userId, firstName: "", surname: "", phone: "", name: "" },
  savedIds: [],
  likedIds: [],
  contractorLikedIds: [],
  threads: {},
  viewingRequested: {},
});

export const supabaseAccountStateRepository = Object.freeze({
  async getUserState() {
    const userId = activeUserKey();
    const empty = emptyState(userId);
    if (!userId) return empty;

    const [profileResult, likes, saves, contractorLikes, viewings, participantRows] = await Promise.all([
      supabaseProfileRepository.getProfile(userId).catch(() => null),
      supabase.from("property_likes").select("property_id").eq("user_id", userId),
      supabase.from("property_saves").select("property_id").eq("user_id", userId),
      supabase.from("contractor_likes").select("contractor_id").eq("user_id", userId),
      supabase.from("viewing_requests").select("property_id").eq("user_id", userId),
      supabase.from("conversation_participants").select("conversation_id").eq("user_id", userId),
    ]);

    const conversationIds = (participantRows.data || []).map((row) => row.conversation_id);
    const threads = {};
    if (conversationIds.length) {
      const { data: messageRows } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_user_id, body, sent_at")
        .in("conversation_id", conversationIds)
        .is("deleted_at", null)
        .order("sent_at");
      for (const row of messageRows || []) {
        const key = String(row.conversation_id);
        if (!threads[key]) threads[key] = [];
        threads[key].push(rowToLegacyMessage(row, userId));
      }
      for (const key of Object.keys(threads)) {
        threads[key] = threads[key].slice(-MESSAGE_DISPLAY_LIMIT);
      }
    }

    return {
      profile: profileResult?.user
        ? rowToProfile(profileResult.user, profileResult.student)
        : empty.profile,
      likedIds: (likes.data || []).map((row) => String(row.property_id)),
      savedIds: (saves.data || []).map((row) => String(row.property_id)),
      contractorLikedIds: (contractorLikes.data || []).map((row) => String(row.contractor_id)),
      viewingRequested: Object.fromEntries(
        (viewings.data || []).map((row) => [String(row.property_id), true])
      ),
      threads,
    };
  },

  async saveUserState(input) {
    const userId = activeUserKey();
    if (!userId) return;

    const syncSet = async (table, column, nextIds) => {
      const wanted = new Set((nextIds || []).map(String));
      const { data, error } = await supabase.from(table).select(column).eq("user_id", userId);
      if (error) throw error;
      const have = new Set((data || []).map((row) => String(row[column])));
      const toAdd = [...wanted].filter((id) => !have.has(id));
      const toRemove = [...have].filter((id) => !wanted.has(id));

      if (toAdd.length) {
        const { error: insertError } = await supabase.from(table).upsert(
          toAdd.map((id) => ({ user_id: userId, [column]: id })),
          { onConflict: `user_id,${column}`, ignoreDuplicates: true }
        );
        if (insertError) throw insertError;
      }
      if (toRemove.length) {
        const { error: deleteError } = await supabase
          .from(table).delete().eq("user_id", userId).in(column, toRemove);
        if (deleteError) throw deleteError;
      }
    };

    if (input?.likedIds !== undefined) await syncSet("property_likes", "property_id", input.likedIds);
    if (input?.savedIds !== undefined) await syncSet("property_saves", "property_id", input.savedIds);
    if (input?.contractorLikedIds !== undefined) await syncSet("contractor_likes", "contractor_id", input.contractorLikedIds);

    if (input?.viewingRequested !== undefined && isObject(input.viewingRequested)) {
      const wanted = Object.entries(input.viewingRequested)
        .filter(([, value]) => value)
        .map(([id]) => String(id));
      if (wanted.length) {
        const { error } = await supabase.from("viewing_requests").upsert(
          wanted.map((propertyId) => ({ id: newId("viewing"), user_id: userId, property_id: propertyId })),
          { onConflict: "user_id,property_id", ignoreDuplicates: true }
        );
        if (error) throw error;
      }
    }
  },
});
