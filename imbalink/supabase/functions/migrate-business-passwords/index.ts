import { createClient } from "npm:@supabase/supabase-js@2";
import { hashPassword, isHashedCredential, normalizeUsername } from "../_shared/password.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function authorized(req: Request) {
  const secret = Deno.env.get("BUSINESS_PASSWORD_MIGRATION_SECRET");
  return Boolean(secret && req.headers.get("x-migration-secret") === secret);
}

async function migrate() {
  const { data: rows, error } = await admin.from("registrations").select("id, user_id, submitted");
  if (error) throw error;
  const results = { scanned: rows?.length || 0, migrated: 0, skipped: 0, failed: 0 };

  for (const row of rows || []) {
    const submitted = { ...(row.submitted || {}) };
    const username = normalizeUsername(String(submitted.username || ""));
    const plaintext = typeof submitted.password === "string" ? submitted.password : "";
    const existingHash = submitted.passwordHash;
    if (!username || (!plaintext && !isHashedCredential(existingHash))) { results.skipped++; continue; }

    try {
      const passwordHash = isHashedCredential(existingHash) ? existingHash : await hashPassword(plaintext);
      const { error: credentialError } = await admin.from("user_credentials").upsert({
        user_id: row.user_id,
        username,
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (credentialError) throw credentialError;

      if (plaintext || existingHash) {
        delete submitted.password;
        delete submitted.confirmPassword;
        delete submitted.passwordHash;
        const { error: cleanError } = await admin.from("registrations")
          .update({ submitted, updated_at: new Date().toISOString() }).eq("id", row.id);
        if (cleanError) throw cleanError;
      }

      const { data: authUser, error: authLookupError } = await admin.auth.admin.getUserById(String(row.user_id));
      if (authLookupError) throw authLookupError;
      if (plaintext) {
        if (!authUser?.user) throw new Error('AUTH_USER_NOT_FOUND');
        const { error: authError } = await admin.auth.admin.updateUserById(String(row.user_id), {
          password: plaintext, email_confirm: true,
        });
        if (authError) throw authError;
      }
      results.migrated++;
    } catch (error) {
      console.error("migration failed", row.id, error);
      results.failed++;
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await migrate());
  } catch (error) {
    console.error(error);
    return Response.json({ error: "MIGRATION_FAILED" }, { status: 500 });
  }
});
