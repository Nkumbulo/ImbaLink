import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) throw new Error("NOT_SIGNED_IN");

    // Caller-bound client: this RPC evaluates the caller's real JWT plus the
    // database approval state. Never trust app_metadata alone here.
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) throw new Error("NOT_SIGNED_IN");
    const actor = authData.user;

    const body = await req.json();
    const id = String(body.user_id || "");
    const action = String(body.action || "");
    if (!id) throw new Error("USER_ID_REQUIRED");

    const { error: permissionError } = await caller.rpc("admin_authorize_action", { p_action: action });
    if (permissionError) throw permissionError;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id,email,display_name,admin_role,admin_status,soft_deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (targetError || !target) throw new Error("USER_NOT_FOUND");

    if (action === "hard_delete") {
      if (body.confirmation !== "DELETE") throw new Error("TYPE_DELETE_TO_CONFIRM");

      // Auth and Postgres public.users cannot share one transaction. Start a
      // durable deletion transaction in Postgres, then delete Auth, then
      // finalize the public transaction. If Auth fails, the public mutation is
      // cancelled; if finalization fails, the pending id is retryable.
      let pendingId = body.pending_id ? String(body.pending_id) : "";
      if (!pendingId) {
        const reason = String(body.reason || "Permanent deletion").slice(0, 500);
        const { data: started, error: startError } = await caller.rpc("admin_begin_hard_delete", {
          p_id: id,
          p_reason: reason,
        });
        if (startError) throw startError;
        pendingId = String(started.pending_id);
      }

      // Retry path: Auth may already have been deleted. In that case skip
      // deleteUser and finalize the durable public transaction.
      if (!body.auth_deleted) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) {
          await caller.rpc("admin_cancel_hard_delete", { p_pending: pendingId, p_reason: error.message });
          throw error;
        }
        const { error: markError } = await caller.rpc("admin_mark_hard_delete_auth_complete", {
          p_pending: pendingId,
        });
        if (markError) throw markError;
      }

      const { data: finalized, error: finalizeError } = await caller.rpc("admin_finalize_hard_delete", {
        p_pending: pendingId,
      });
      if (finalizeError) {
        return json({ ok: false, action, pending_id: pendingId, auth_deleted: true, retryable: true, error: finalizeError.message }, 409);
      }
      return json({ ok: true, action, pending_id: pendingId, status: finalized?.status || "completed" });
    }

    if (action === "set_role") {
      const newRole = String(body.role || "user");
      if (!["user", "agent", "agency", "admin", "super_admin"].includes(newRole)) {
        throw new Error("INVALID_ROLE");
      }
      // admin_authorize_action already prevents role assignment for ordinary admins.
      // Keep the public role and Auth metadata synchronized. If the second
      // write fails, compensate the first write immediately and surface the
      // failure instead of leaving two different authorities.
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, {
        app_metadata: { role: newRole },
      });
      if (authUpdateError) throw authUpdateError;
      const { error: dbError } = await admin
        .from("users")
        .update({ admin_role: newRole, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (dbError) {
        await admin.auth.admin.updateUserById(id, { app_metadata: { role: target.admin_role || "user" } });
        throw dbError;
      }
      const { error: auditError } = await admin.rpc("audit_event", {
        p_action: "user.role_changed",
        p_resource_type: "user",
        p_resource_id: id,
        p_metadata: { old_role: target.admin_role, role: newRole },
        p_actor_user_id: actor.id,
      });
      if (auditError) throw auditError;
      return json({ ok: true, action, role: newRole });
    }

    if (action === "reset_password") {
      if (!target.email) throw new Error("USER_HAS_NO_EMAIL");
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: target.email,
        options: {
          redirectTo: `${Deno.env.get("APP_URL") || Deno.env.get("SUPABASE_URL")}/reset-password`,
        },
      });
      if (error) throw error;
      await admin.from("admin_audit_log").insert({
        actor_user_id: actor.id,
        action: "user.password_reset_link_generated",
        resource_type: "user",
        resource_id: id,
        metadata: { email: target.email },
      });
      return json({ ok: true, action, link: data?.properties?.action_link || null });
    }

    if (action === "impersonate") {
      if (!target.email) throw new Error("USER_HAS_NO_EMAIL");
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
        options: { redirectTo: Deno.env.get("APP_URL") || "/" },
      });
      if (error) throw error;
      await admin.from("admin_audit_log").insert({
        actor_user_id: actor.id,
        action: "user.impersonation_link_generated",
        resource_type: "user",
        resource_id: id,
        metadata: { target_email: target.email, warning: "temporary administrative access link" },
      });
      return json({ ok: true, action, link: data?.properties?.action_link || null });
    }

    throw new Error("INVALID_ACTION");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "ADMIN_ACTION_FAILED" }, 400);
  }
});
