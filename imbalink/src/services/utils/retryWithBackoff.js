// Generic retry-with-exponential-backoff-and-jitter helper.
//
// Built specifically to let the landlord photo-upload flow absorb transient
// network blips automatically, behind the scenes, before ever bothering the
// user with a "try again" — a single flaky moment on one photo out of
// several used to fail the entire submission and force a full manual
// restart. Kept generic (not upload-specific) since the same shape is
// useful anywhere a network call needs to quietly retry itself first.
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 6000;

// Some failures can never be fixed by retrying the identical request — the
// local photo blob is simply gone, or the server has definitively rejected
// it (bad auth, no permission). Retrying those just burns time before
// showing the same unavoidable error anyway, so they fail fast instead.
export function isRetryableError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (/no longer available|unavailable/.test(message)) return false;
  if (/not authorized|unauthorized|forbidden|permission denied/.test(message)) return false;
  if (/invalid (file|photo|image)/.test(message)) return false;
  return true;
}

export async function retryWithBackoff(fn, {
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  isRetryable = isRetryableError,
  onAttemptFailed,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxAttempts;
      const retryable = isRetryable(error);
      onAttemptFailed?.({ attempt, maxAttempts, error, willRetry: !isLastAttempt && retryable });
      if (isLastAttempt || !retryable) throw error;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      // Jitter keeps several concurrently-retrying photo uploads from all
      // hammering the server again at the exact same instant.
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }
  throw lastError;
}
