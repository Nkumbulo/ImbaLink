/**
 * Stable application error contract.
 *
 * UI/domain code should branch on error category, not provider-specific
 * strings. `cause` preserves the original error for diagnostics without
 * leaking it into user-facing messages.
 */
export class AppError extends Error {
  constructor(message, { code = "APP_ERROR", status = 0, cause = null, details = null, retryable = null } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = Number(status || 0);
    this.cause = cause;
    this.details = details;
    this.retryable = retryable;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, options = {}) { super(message, { ...options, code: options.code || "VALIDATION_ERROR", status: options.status || 422, retryable: false }); this.name = "ValidationError"; }
}
export class AuthenticationError extends AppError {
  constructor(message = "Authentication is required.", options = {}) { super(message, { ...options, code: options.code || "AUTH_REQUIRED", status: options.status || 401, retryable: false }); this.name = "AuthenticationError"; }
}
export class AuthorizationError extends AppError {
  constructor(message = "You are not allowed to perform this action.", options = {}) { super(message, { ...options, code: options.code || "FORBIDDEN", status: options.status || 403, retryable: false }); this.name = "AuthorizationError"; }
}
export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.", options = {}) { super(message, { ...options, code: options.code || "NOT_FOUND", status: options.status || 404, retryable: false }); this.name = "NotFoundError"; }
}
export class ConflictError extends AppError {
  constructor(message = "The resource changed before this action completed.", options = {}) { super(message, { ...options, code: options.code || "CONFLICT", status: options.status || 409, retryable: false }); this.name = "ConflictError"; }
}
export class NetworkError extends AppError {
  constructor(message = "The network request failed.", options = {}) { super(message, { ...options, code: options.code || "NETWORK", status: options.status || 0, retryable: true }); this.name = "NetworkError"; }
}
export class TimeoutError extends NetworkError {
  constructor(message = "The request timed out.", options = {}) { super(message, { ...options, code: options.code || "TIMEOUT" }); this.name = "TimeoutError"; }
}
export class ServerError extends AppError {
  constructor(message = "The server could not complete the request.", options = {}) { super(message, { ...options, code: options.code || "SERVER_ERROR", status: options.status || 500, retryable: true }); this.name = "ServerError"; }
}

export function normalizeError(error, fallback = "Something went wrong.") {
  if (error instanceof AppError) return error;
  const status = Number(error?.status || error?.context?.status || 0);
  const code = error?.code || error?.name || "UNKNOWN_ERROR";
  const message = error?.message || fallback;
  if (status === 401) return new AuthenticationError(message, { code, cause: error });
  if (status === 403) return new AuthorizationError(message, { code, cause: error });
  if (status === 404) return new NotFoundError(message, { code, cause: error });
  if (status === 409) return new ConflictError(message, { code, cause: error });
  if (status === 408 || code === "TIMEOUT") return new TimeoutError(message, { code, cause: error });
  if (status === 429 || status >= 500) return new ServerError(message, { code, status, cause: error });
  if (status === 400 || status === 422) return new ValidationError(message, { code, status, cause: error });
  if (status === 0) return new NetworkError(message, { code, cause: error });
  return new AppError(message, { code, status, cause: error });
}
