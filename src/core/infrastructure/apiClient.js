/**
 * HTTP client for the ImbaLink backend.
 *
 * This file is the ONLY place in the app that knows a server exists. It is
 * inert until `VITE_API_BASE_URL` is set in the environment:
 * `isBackendEnabled()` returns false, `request()` rejects immediately with
 * BACKEND_DISABLED, and every caller (core/sync/outbox.js) treats that
 * as "stay offline". So with no .env change, the app behaves exactly as it
 * did before this file existed — same code path, same data, same UI.
 *
 * To turn the backend on:
 *   .env.local
 *     VITE_API_BASE_URL=https://api.imbalink.co.zw
 *
 * Auth: the bearer token is read through a getter the auth layer installs
 * (see setAuthTokenProvider), rather than this module importing the auth
 * layer. That direction matters — auth already depends on services/database
 * .js, and database.js will depend on the sync layer, so importing auth from
 * here would close a cycle.
 */

import { AppError } from "../errors/AppError";

const BASE_URL = String(import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 15_000;

let authTokenProvider = () => null;

/** Installed once by the auth layer; see auth/AuthContext.jsx. */
export function setAuthTokenProvider(provider) {
  authTokenProvider = typeof provider === "function" ? provider : () => null;
}

export function isBackendEnabled() {
  return BASE_URL.length > 0;
}

export function apiBaseUrl() {
  return BASE_URL;
}

export class ApiError extends AppError {
  constructor(message, { status = 0, code = "", body = null } = {}) {
    super(message, { code: code || "API_ERROR", status, cause: null });
    this.name = "ApiError";
    this.body = body;
  }

  /**
   * True when retrying later could plausibly succeed: network failures,
   * timeouts, rate limiting and 5xx. A 400/409/422 means the server has
   * looked at this payload and rejected it — retrying sends the identical
   * bytes and gets the identical answer, so the outbox drops it instead of
   * blocking the queue behind it forever.
   */
  get retryable() {
    if (this.status === 0) return true; // offline / DNS / CORS preflight failure
    if (this.status === 408 || this.status === 429) return true;
    return this.status >= 500;
  }
}

/**
 * Perform an API request. Rejects with ApiError. `path` is relative to the
 * base URL, e.g. "/v1/listings".
 */
export async function request(path, { method = "GET", body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  if (!isBackendEnabled()) {
    throw new ApiError("No API base URL is configured.", { code: "BACKEND_DISABLED" });
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  if (signal && controller) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let token = null;
  try {
    token = await authTokenProvider();
  } catch {
    token = null;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (error) {
    throw new ApiError(error?.name === "AbortError" ? "The request timed out." : "The network request failed.", {
      status: 0,
      code: error?.name === "AbortError" ? "TIMEOUT" : "NETWORK",
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  const text = await response.text().catch(() => "");
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(parsed?.message || `Request failed with status ${response.status}.`, {
      status: response.status,
      code: parsed?.code || "",
      body: parsed,
    });
  }

  return parsed;
}

/**
 * Upload binary content (listing photos, verification documents) as
 * multipart/form-data. Kept separate from request() because it must not set
 * a JSON Content-Type — the browser has to write the multipart boundary
 * itself.
 */
export async function uploadFile(path, blob, { filename = "upload", fields = {}, timeoutMs = 60_000 } = {}) {
  if (!isBackendEnabled()) {
    throw new ApiError("No API base URL is configured.", { code: "BACKEND_DISABLED" });
  }

  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  form.append("file", blob, filename);

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let token = null;
  try {
    token = await authTokenProvider();
  } catch {
    token = null;
  }

  try {
    const response = await fetch(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      method: "POST",
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
      signal: controller?.signal,
    });
    const text = await response.text().catch(() => "");
    const parsed = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new ApiError(parsed?.message || `Upload failed with status ${response.status}.`, {
        status: response.status,
        body: parsed,
      });
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("The upload failed.", { status: 0, code: "NETWORK" });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
