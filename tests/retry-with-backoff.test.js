import { describe, expect, it, vi } from 'vitest';
import { retryWithBackoff, isRetryableError } from '../src/services/utils/retryWithBackoff.js';

describe('isRetryableError', () => {
  it('treats a missing/unavailable local photo as non-retryable', () => {
    expect(isRetryableError(new Error('LISTING_PHOTO_UNAVAILABLE: Photo 2 is no longer available.'))).toBe(false);
  });

  it('treats a permission/auth rejection as non-retryable', () => {
    expect(isRetryableError(new Error('permission denied for table properties'))).toBe(false);
    expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
  });

  it('treats a generic/network-looking error as retryable', () => {
    expect(isRetryableError(new Error('Failed to fetch'))).toBe(true);
    expect(isRetryableError(new Error('network timeout'))).toBe(true);
    expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
  });
});

describe('retryWithBackoff', () => {
  it('returns the result immediately on first success — no delay, no retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure automatically and succeeds without the caller ever seeing an error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, { baseDelayMs: 1, maxDelayMs: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxAttempts and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'));
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 })).rejects.toThrow('network error');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry a non-retryable error — fails fast on the first attempt', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('LISTING_PHOTO_UNAVAILABLE: gone'));
    await expect(retryWithBackoff(fn, { maxAttempts: 5, baseDelayMs: 1 })).rejects.toThrow('UNAVAILABLE');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onAttemptFailed with willRetry=false on the final exhausted attempt', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'));
    const onAttemptFailed = vi.fn();
    await expect(retryWithBackoff(fn, { maxAttempts: 2, baseDelayMs: 1, onAttemptFailed })).rejects.toThrow();
    expect(onAttemptFailed).toHaveBeenCalledTimes(2);
    expect(onAttemptFailed.mock.calls[0][0].willRetry).toBe(true);
    expect(onAttemptFailed.mock.calls[1][0].willRetry).toBe(false);
  });
});
