import { rpc, invokeFunction } from "../../core/data/rpc";
import { supabase } from "../../core/supabase/client";

export const getAdminInsights = async () => (await rpc("get_admin_insights")) || {};
export const getAdminAuditLog = async ({ limit = 100, offset = 0 } = {}) =>
  (await rpc("get_admin_audit_log", { p_limit: limit, p_offset: offset })) || { rows: [], total: 0 };
export const exportAdminData = async (resource, limit = 5000) => {
  const data = await rpc("export_admin_data", { p_resource: resource, p_limit: limit });
  return Array.isArray(data) ? data : [];
};
export const createLandlordInvite = (payload) => invokeFunction("admin-create-landlord", payload);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadJSON(rows, filename) {
  downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" }), filename);
}
function csvEscape(value) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function downloadCSV(rows, filename) {
  const list = Array.isArray(rows) ? rows : [];
  const keys = [...new Set(list.flatMap((row) => Object.keys(row || {})))];
  const csv = [keys.map(csvEscape).join(","), ...list.map((row) => keys.map((key) => csvEscape(row?.[key])).join(","))].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

export const getAdminPropertyImages = async (propertyId) => {
  const { data, error } = await supabase
    .from("property_images")
    .select("id, property_id, url, position, width, height, bytes, created_at")
    .eq("property_id", String(propertyId))
    .order("position", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const deleteAdminPropertyImage = (imageId) =>
  rpc("admin_delete_property_image", { p_image_id: String(imageId) });
