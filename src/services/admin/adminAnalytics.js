import { rpc } from "../../core/data/rpc";
import { getStaffAuthorization } from "../../core/auth/authorization";

const safeArray = (value) => (Array.isArray(value) ? value : []);

export async function getAdminDashboard({ from, to, city = "all", accountType = "all" } = {}) {
  return (await rpc("get_admin_dashboard", {
    p_from: from || null,
    p_to: to || null,
    p_city: city === "all" ? null : city,
    p_account_type: accountType === "all" ? null : accountType,
  })) || {};
}

export async function getAdminUsers({ search = "", accountType = "all", limit = 50, offset = 0 } = {}) {
  return (await rpc("get_admin_users", {
    p_search: search || null,
    p_account_type: accountType === "all" ? null : accountType,
    p_limit: limit,
    p_offset: offset,
  })) || { rows: [], total: 0 };
}

export async function getAdminProperties({ search = "", status = "all", limit = 50, offset = 0 } = {}) {
  return (await rpc("get_admin_properties", {
    p_search: search || null,
    p_status: status === "all" ? null : status,
    p_limit: limit,
    p_offset: offset,
  })) || { rows: [], total: 0 };
}

export async function getAdminReports({ status = "all", limit = 50, offset = 0 } = {}) {
  return (await rpc("get_admin_reports", {
    p_status: status === "all" ? null : status,
    p_limit: limit,
    p_offset: offset,
  })) || { rows: [], total: 0 };
}

export function setAdminVerification(store, id, status, note = "") {
  return rpc("set_verification_status", { p_store_name: store, p_id: String(id), p_status: status, p_note: note });
}

export function setAdminReportStatus(id, status) {
  return rpc("set_report_status", { p_report_id: String(id), p_status: status });
}

export const checkStaffRole = getStaffAuthorization;

export const adminFormat = {
  number: (value) => Number(value || 0).toLocaleString(),
  money: (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  percent: (value) => `${Number(value || 0).toFixed(1)}%`,
  safeArray,
};
