import { supabase } from "../supabase/client";
import { rpc } from "../data/rpc";

// Mirrors backend/033-authorization-contract.sql's admin_authorization(),
// which is the current, authoritative server-side role check (its own
// comment calls it "the centralized server-side authorization contract").
// A role of "admin" or "super_admin" is the whole list — there is no
// "moderator"/"staff" tier in this contract. (backend/013's older
// is_staff_caller() did recognize admin/moderator/staff, but that was
// superseded by 033 for anything routed through admin_access_check(),
// which is what both admin surfaces actually call.)
export const ADMIN_ROLES = Object.freeze(["admin", "super_admin"]);

export function roleFromUser(user) {
  return user?.app_metadata?.role || null;
}

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdminRole(role) {
  return role === "super_admin";
}

/**
 * Client-side staff gate. This is UX protection only; privileged server
 * operations MUST enforce authorization again in SQL/RPC/Edge Functions.
 */
export async function getStaffAuthorization() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const user = data?.user || null;
  const role = roleFromUser(user);
  if (!isAdminRole(role)) {
    return { user, role, isStaff: false, isSuperAdmin: false, accessStatus: "unauthorized" };
  }

  const result = await rpc("admin_access_check");
  return {
    user,
    role,
    isStaff: Boolean(result?.allowed),
    isSuperAdmin: isSuperAdminRole(role),
    accessStatus: result?.status || "pending",
  };
}
