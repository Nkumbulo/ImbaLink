import { describe, expect, it } from 'vitest';
import { AppError, ValidationError, AuthenticationError, AuthorizationError, ConflictError, NetworkError, TimeoutError, ServerError, normalizeError } from '../src/core/errors/AppError.js';

describe('application error contract', () => {
  it('exposes stable error categories', () => {
    expect(new ValidationError('x')).toBeInstanceOf(AppError);
    expect(new AuthenticationError()).toBeInstanceOf(AppError);
    expect(new AuthorizationError()).toBeInstanceOf(AppError);
    expect(new ConflictError()).toBeInstanceOf(AppError);
    expect(new NetworkError()).toBeInstanceOf(AppError);
    expect(new TimeoutError()).toBeInstanceOf(NetworkError);
    expect(new ServerError()).toBeInstanceOf(AppError);
  });

  it('normalizes HTTP errors into predictable categories', () => {
    expect(normalizeError({ status: 401 }).name).toBe('AuthenticationError');
    expect(normalizeError({ status: 403 }).name).toBe('AuthorizationError');
    expect(normalizeError({ status: 409 }).name).toBe('ConflictError');
    expect(normalizeError({ status: 422 }).name).toBe('ValidationError');
    expect(normalizeError({ status: 500 }).name).toBe('ServerError');
    expect(normalizeError({ status: 0 }).name).toBe('NetworkError');
  });
});
