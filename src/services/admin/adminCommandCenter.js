import { rpc, invokeFunction } from "../../core/data/rpc";

export const getCommandUsers = (args = {}) => rpc("admin_get_users", {
  p_search: args.search || null, p_status: args.status || null, p_role: args.role || null,
  p_limit: args.limit || 50, p_offset: args.offset || 0,
});
export const updateUser = (id, changes, reason = "") => rpc("admin_update_user", { p_id: String(id), p_changes: changes, p_reason: reason });
export const userAction = (id, action, reason = "") => rpc("admin_user_lifecycle", { p_id: String(id), p_action: action, p_reason: reason });
export const getUserDetail = (id) => rpc("admin_get_user_detail", { p_id: String(id) });
export const addUserNote = (id, note) => rpc("admin_add_user_note", { p_user_id: String(id), p_note: note });
export const getCommandProperties = (args = {}) => rpc("admin_get_properties", { p_search: args.search || null, p_status: args.status || null, p_limit: args.limit || 50, p_offset: args.offset || 0 });
export const updateProperty = (id, changes, reason = "") => rpc("admin_update_property", { p_id: String(id), p_changes: changes, p_reason: reason });
export const propertyAction = (id, action, reason = "") => rpc("admin_property_action", { p_id: String(id), p_action: action, p_reason: reason });
export const getCommandSettings = () => rpc("admin_get_settings");
export const saveCommandSetting = (key, value) => rpc("admin_save_setting", { p_key: key, p_value: value });
export const getBroadcasts = () => rpc("admin_get_broadcasts");
export const saveBroadcast = (id, payload) => rpc("admin_save_broadcast", { p_id: id, p_payload: payload });
export const getCommandAudit = (limit = 100, offset = 0) => rpc("admin_get_audit", { p_limit: limit, p_offset: offset });
export const getCommandDashboard = () => rpc("admin_get_dashboard");
export const adminUserEdgeAction = (user_id, action, extra = {}) => invokeFunction("admin-user-action", { user_id, action, ...extra });
