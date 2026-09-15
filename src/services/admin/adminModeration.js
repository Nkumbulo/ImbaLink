import { rpc } from "../../core/data/rpc";
export async function getModerationRecords(store) { const data = await rpc("get_moderation_records", { p_store_name: store }); return Array.isArray(data) ? data : []; }
export async function getAdminVerificationQueue(store, status = "pending") { const data = await rpc("get_admin_verification_queue", { p_store_name: store, p_status: status || null, p_limit: 100, p_offset: 0 }); return Array.isArray(data) ? data : []; }
export async function getNeglectedVerifications(store = null) { const data = await rpc("get_neglected_verifications", { p_store_name: store, p_limit: 200, p_offset: 0 }); return Array.isArray(data) ? data : []; }
export const neglectVerification = (store, id, note = "") => rpc("neglect_verification_record", { p_store_name: store, p_id: String(id), p_note: note });
export const restoreNeglectedVerification = (store, id, note = "") => rpc("restore_neglected_verification", { p_store_name: store, p_id: String(id), p_note: note });
