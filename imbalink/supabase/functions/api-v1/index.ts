import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const APP_ORIGIN = Deno.env.get("APP_ORIGIN")?.trim();
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN || "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-mutation-id",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

function mutationFor(path: string, method: string, body: any) {
  const parts = path.replace(/^\/v1\/?/, "").split("/").filter(Boolean);
  const id = parts[1] || null;
  const key = `${method.toUpperCase()} ${parts.join("/")}`;
  if (key === "POST listings") return ["listing.create", null, body];
  if (key === "PATCH listings" || (method === "PATCH" && parts[0] === "listings")) return ["listing.update", id, body];
  if (key === "DELETE listings" || (method === "DELETE" && parts[0] === "listings")) return ["listing.delete", id, body || {}];
  if (method === "PUT" && parts[0] === "profiles") return ["profile.upsert", id, body];
  if (method === "PUT" && parts[0] === "properties" && parts[2] === "like") return ["like.set", id, body];
  if (method === "PUT" && parts[0] === "properties" && parts[2] === "save") return ["save.set", id, body];
  if (method === "PUT" && parts[0] === "contractors" && parts[2] === "like") return ["contractorLike.set", id, body];
  if (method === "POST" && parts[0] === "viewing-requests") return ["viewingRequest.create", body?.id || null, body];
  if (method === "POST" && parts[0] === "quote-requests") return ["quoteRequest.create", body?.id || null, body];
  if (method === "POST" && parts[0] === "share-requests") return ["shareRequest.create", body?.id || null, body];
  if (method === "PATCH" && parts[0] === "share-requests") return ["shareRequest.update", id, body];
  if (method === "DELETE" && parts[0] === "share-requests") return ["shareRequest.delete", id, body || {}];
  if (method === "PUT" && parts[0] === "student-interests") return ["studentInterest.set", id, body];
  if (method === "PUT" && parts[0] === "registrations") return ["registration.upsert", id, body];
  if (method === "POST" && parts[0] === "messages") return ["message.send", body?.conversationId || null, body];
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!APP_ORIGIN) return json({ code: "APP_ORIGIN_NOT_CONFIGURED", message: "APP_ORIGIN must be configured." }, 500);
    return new Response("ok", { headers: corsHeaders });
  }
  if (!APP_ORIGIN) return json({ code: "APP_ORIGIN_NOT_CONFIGURED", message: "APP_ORIGIN must be configured." }, 500);
  const auth = req.headers.get("Authorization");
  const mutationId = req.headers.get("X-Client-Mutation-Id")?.trim();
  if (!auth?.startsWith("Bearer ")) return json({ code: "AUTH_REQUIRED", message: "Authentication is required." }, 401);
  if (!mutationId) return json({ code: "SYNC_MUTATION_ID_REQUIRED", message: "X-Client-Mutation-Id is required." }, 400);

  const url = new URL(req.url);
  const body = req.method === "GET" || req.method === "DELETE" ? (req.method === "DELETE" ? await req.json().catch(() => ({})) : {}) : await req.json().catch(() => ({}));
  const mapped = mutationFor(url.pathname, req.method, body);
  if (!mapped) return json({ code: "MUTATION_ROUTE_NOT_FOUND", message: "Unsupported mutation route." }, 404);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await supabase.rpc("api_mutation", {
    p_operation: mapped[0], p_mutation_id: mutationId, p_entity_id: mapped[1], p_payload: mapped[2] || {},
  });
  if (error) {
    const code = String(error.message || "API_MUTATION_FAILED").split(":")[0];
    const status = /AUTH_REQUIRED/.test(code) ? 401 : /NOT_AUTHORIZED/.test(code) ? 403 : /UNSUPPORTED|ROUTE/.test(code) ? 404 : 422;
    return json({ code, message: error.message || "Mutation failed." }, status);
  }
  return json(data?.data ?? data, 200);
});
