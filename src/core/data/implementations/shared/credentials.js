import { hashPassword, isHashedCredential } from '../../../../services/auth/credentials';

export async function withHashedCredentials(record, existing) {
  const next = { ...record };
  const plaintext = typeof next.password === 'string' ? next.password : '';
  if (plaintext) {
    const hashed = await hashPassword(plaintext).catch(() => null);
    if (hashed) {
      next.passwordHash = hashed;
    } else if (isHashedCredential(existing?.passwordHash)) {
      next.passwordHash = existing.passwordHash;
    }
  } else if (!isHashedCredential(next.passwordHash) && isHashedCredential(existing?.passwordHash)) {
    next.passwordHash = existing.passwordHash;
  }
  delete next.password;
  delete next.confirmPassword;
  return next;
}
