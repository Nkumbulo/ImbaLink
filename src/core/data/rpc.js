import { supabase } from "../supabase/client";
import { AppError, normalizeError } from "../errors/AppError";

/**
 * Canonical RPC gateway.
 *
 * All database RPC calls made by application services should pass through
 * here so error handling and tracing can be standardized without changing
 * every feature service again later.
 */
export async function rpc(name, args = {}, options = {}) {
  if (!name) throw new AppError("RPC name is required.", { code: "RPC_NAME_REQUIRED" });

  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    const wrapped = normalizeError(error, `RPC ${name} failed.`);
    wrapped.code = wrapped.code || error.code || "RPC_ERROR";
    wrapped.details = { ...(wrapped.details || {}), rpc: name, args: options.includeArgsInError ? args : undefined };
    if (options.onError) options.onError(wrapped);
    throw wrapped;
  }

  if (options.onSuccess) {
    options.onSuccess({ rpc: name, durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) });
  }

  return data;
}

export async function invokeFunction(name, body, options = {}) {
  if (!name) throw new AppError("Function name is required.", { code: "FUNCTION_NAME_REQUIRED" });
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new AppError(error.message || `Function ${name} failed.`, {
      code: error.name || "FUNCTION_ERROR",
      status: Number(error.context?.status || 0),
      cause: error,
      details: { function: name },
    });
  }
  if (data?.error) {
    throw new AppError(data.error, { code: data.code || "FUNCTION_REJECTED", details: { function: name } });
  }
  return data;
}
