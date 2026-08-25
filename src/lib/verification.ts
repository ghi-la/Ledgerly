import crypto from 'crypto';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

/** Raw token goes in the emailed link; only its hash is ever persisted. */
export function createVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashVerificationToken(token) };
}

export function hashVerificationToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
