import { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import { getStaffAuthorization } from "../core/auth/authorization";

const EMPTY = { loading: true, user: null, role: null, isStaff: false, isSuperAdmin: false, accessStatus: "pending" };

export default function useAdminAuthorization() {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const result = await getStaffAuthorization();
        if (active) setState({ loading: false, ...result });
      } catch {
        if (active) setState({ loading: false, user: null, role: null, isStaff: false, isSuperAdmin: false, accessStatus: "error" });
      }
    };
    void check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void check(); });
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  return state;
}
