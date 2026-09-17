import { createClient } from "npm:@supabase/supabase-js@2";
import { hashPassword, isHashedCredential, normalizeUsername, verifyPassword, virtualEmail } from "../_shared/password.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function loadCredential(username: string) {
  const { data: credential, error } = await admin
    .from("user_credentials")
    .select("user_id, username, password_hash")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  if (credential) return { credential, legacyRegistration: null };

  // Transitional fallback for records created before user_credentials was
  // introduced. This query stays server-side and is never exposed to clients.
  const { data: legacyRows, error: legacyError } = await admin
    .from("registrations")
    .select("id, user_id, submitted")
    .not("submitted->>username", "is", null);
  if (legacyError) throw legacyError;
  const legacy = (legacyRows || []).find((row) => normalizeUsername(row.submitted?.username) === username);
  if (!legacy) return null;
  return { credential: null, legacyRegistration: legacy };
}

async function signIn(username: string, password: string) {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername || !password) return json({ error: "INVALID_CREDENTIALS" }, 401);

  const loaded = await loadCredential(cleanUsername);
  if (!loaded) return json({ error: "INVALID_CREDENTIALS" }, 401);

  const userId = String(loaded.credential?.user_id || loaded.legacyRegistration?.user_id || "");
  const storedHash = loaded.credential?.password_hash || loaded.legacyRegistration?.submitted?.passwordHash;
  const legacyPassword = loaded.legacyRegistration?.submitted?.password;

  let verified = false;
  let legacyPlaintext = false;
  if (isHashedCredential(storedHash)) {
    verified = await verifyPassword(password, storedHash);
  } else if (typeof legacyPassword === "string" && legacyPassword.length > 0) {
    // Transitional compatibility only. The comparison happens in this
    // server function and is immediately followed by a hash migration.
    verified = legacyPassword === password;
    legacyPlaintext = verified;
  }
  if (!verified || !userId) return json({ error: "INVALID_CREDENTIALS" }, 401);

  const { data: userRow, error: userError } = await admin
    .from("users")
    .select("id, email, phone, first_name, surname, display_name, avatar_url, account_type, onboarded_at, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (userError || !userRow) return json({ error: "INVALID_CREDENTIALS" }, 401);

  const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(userId);
  if (authUserError || !authUserData?.user) return json({ error: "ACCOUNT_AUTH_NOT_READY" }, 409);

  // New/legacy credential records are promoted to Supabase Auth on the first
  // successful server-side login. This makes future sign-ins native Auth and
  // gives the browser a normal Supabase JWT rather than a local session token.
  if (legacyPlaintext || !authUserData.user.email) {
    const nextEmail = authUserData.user.email || userRow.email || virtualEmail(cleanUsername);
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      email: nextEmail,
      password,
      email_confirm: true,
    });
    if (updateError) return json({ error: "ACCOUNT_AUTH_NOT_READY" }, 409);
  } else {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
    if (updateError) return json({ error: "ACCOUNT_AUTH_NOT_READY" }, 409);
  }

  if (legacyPlaintext || !loaded.credential) {
    const passwordHash = await hashPassword(password);
    const { error: credentialError } = await admin.from("user_credentials").upsert({
      user_id: userId,
      username: cleanUsername,
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (credentialError) return json({ error: "CREDENTIAL_MIGRATION_FAILED" }, 500);

    if (loaded.legacyRegistration) {
      const submitted = { ...(loaded.legacyRegistration.submitted || {}) };
      delete submitted.password;
      delete submitted.confirmPassword;
      delete submitted.passwordHash;
      await admin.from("registrations").update({ submitted, updated_at: new Date().toISOString() })
        .eq("id", loaded.legacyRegistration.id);
    }
  }

  const authEmail = authUserData.user.email || userRow.email || virtualEmail(cleanUsername);
  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({ email: authEmail, password });
  if (signInError || !sessionData.session) return json({ error: "AUTH_SESSION_FAILED" }, 500);

  return json({
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at,
      expires_in: sessionData.session.expires_in,
    },
    user: {
      id: userRow.id,
      email: userRow.email || authEmail,
      phone: userRow.phone || "",
      firstName: userRow.first_name || "",
      surname: userRow.surname || "",
      name: userRow.display_name || `${userRow.first_name || ""} ${userRow.surname || ""}`.trim(),
      avatarUrl: userRow.avatar_url || "",
      accountType: userRow.account_type || null,
      onboardedAt: userRow.onboarded_at || null,
      createdAt: userRow.created_at || null,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const body = await req.json();
    if (body?.action !== "signIn") return json({ error: "UNSUPPORTED_ACTION" }, 400);
    return await signIn(String(body.username || ""), String(body.password || ""));
  } catch (error) {
    console.error("business-auth failed", error);
    return json({ error: "AUTH_SERVICE_UNAVAILABLE" }, 503);
  }
});
