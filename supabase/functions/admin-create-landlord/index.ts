import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);
  const role = authData.user.app_metadata?.role;
  if (role !== "admin") return json({ error: "Administrator role required" }, 403);

  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const surname = String(body.surname || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const city = String(body.city || "Harare").trim();
  if (!firstName || !surname || !email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "First name, surname and a valid email are required." }, 400);

  const admin = createClient(url, service);
  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { given_name: firstName, family_name: surname, full_name: `${firstName} ${surname}`, phone },
  });
  if (inviteError) return json({ error: inviteError.message }, 400);
  const userId = invite.user?.id;
  if (!userId) return json({ error: "Supabase did not return the invited user." }, 500);

  const { error: profileError } = await admin.from("users").update({
    first_name: firstName,
    surname,
    display_name: `${firstName} ${surname}`,
    email,
    phone: phone || null,
    account_type: "landlord",
  }).eq("id", userId);
  if (profileError) return json({ error: profileError.message }, 500);

  const { error: registrationError } = await admin.from("registrations").upsert({
    id: `registration_${crypto.randomUUID()}`,
    user_id: userId,
    kind: "landlord",
    legal_name: `${firstName} ${surname}`,
    phone: phone || null,
    email,
    verification_status: "pending",
    review_note: "Created manually by an administrator.",
    submitted: { source: "admin_manual", city },
  }, { onConflict: "user_id,kind" });
  if (registrationError) return json({ error: registrationError.message }, 500);

  const { error: auditError } = await admin.from("admin_audit_log").insert({
    actor_user_id: authData.user.id,
    action: "landlord.created_manual",
    resource_type: "user",
    resource_id: userId,
    metadata: { email, city, verification: "pending" },
  });
  if (auditError) console.error("audit insert failed", auditError);

  return json({ ok: true, user_id: userId, message: `Landlord account created. An invitation was sent to ${email}.` });
});
