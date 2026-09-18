import { supabase } from "../client";
import { activeUserKey } from "../../../core/data/implementations/shared/identity";
import { setLocalRelation, localRelationCount } from "../../../core/sync/localFirst";

async function readPropertySaveCount(propertyId) {
  const id = String(propertyId);
  const { data, error } = await supabase.rpc("get_property_save_count", {
    p_property_id: id,
  });
  if (!error && data != null) return Math.max(0, Number(data) || 0);

  const { data: rows } = await supabase
    .from("property_saves")
    .select("property_id")
    .eq("property_id", id);
  return Array.isArray(rows) ? rows.length : 0;
}

async function setPropertyLike(propertyId, liked) {
  const userId = activeUserKey();
  if (!userId) return;
  const id = String(propertyId);
  await setLocalRelation("propertyLikes", {
    userId,
    itemId: id,
    liked: Boolean(liked),
    operation: "like.set",
    routeEntityId: id,
  });

  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const query = liked
    ? supabase.from("property_likes").upsert(
        { user_id: userId, property_id: id },
        { onConflict: "user_id,property_id", ignoreDuplicates: true }
      )
    : supabase.from("property_likes").delete().eq("user_id", userId).eq("property_id", id);
  const { error } = await query;
  if (error) console.warn("Property like sync failed:", error.message);
}

async function setPropertySave(propertyId, saved) {
  const userId = activeUserKey();
  if (!userId) return 0;
  const id = String(propertyId);
  await setLocalRelation("propertySaves", {
    userId,
    itemId: id,
    liked: Boolean(saved),
    operation: "save.set",
    routeEntityId: id,
  });

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return localRelationCount("propertySaves", id);
  }

  const query = saved
    ? supabase.from("property_saves").upsert(
        { user_id: userId, property_id: id },
        { onConflict: "user_id,property_id", ignoreDuplicates: true }
      )
    : supabase.from("property_saves").delete().eq("user_id", userId).eq("property_id", id);
  const { error } = await query;
  if (error) {
    console.warn("Property save sync failed:", error.message);
    return localRelationCount("propertySaves", id);
  }
  return readPropertySaveCount(id);
}

async function recordPropertyView(propertyId) {
  const key = String(propertyId || "").trim();
  if (!key || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const { error } = await supabase.rpc("record_property_view", {
    p_property_id: key,
  });
  if (error) console.warn("record_property_view failed:", error.message);
}

async function setContractorLike(contractorId, liked) {
  const userId = activeUserKey();
  if (!userId) return;
  const id = String(contractorId);
  await setLocalRelation("contractorLikes", {
    userId,
    itemId: id,
    liked: Boolean(liked),
    operation: "contractorLike.set",
    routeEntityId: id,
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const query = liked
    ? supabase.from("contractor_likes").upsert(
        { user_id: userId, contractor_id: id },
        { onConflict: "user_id,contractor_id", ignoreDuplicates: true }
      )
    : supabase.from("contractor_likes").delete().eq("user_id", userId).eq("contractor_id", id);
  const { error } = await query;
  if (error) console.warn("Contractor like sync failed:", error.message);
}

export const supabaseInteractionRepository = Object.freeze({
  setPropertyLike,
  setPropertySave,
  recordPropertyView,
  setContractorLike,
});
