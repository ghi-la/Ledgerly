import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { hashVerificationToken } from '@/lib/verification';

export const POST = route(async (req: Request) => {
  const { token, password } = await req.json();
  if (!token || typeof token !== 'string') {
    throw new HttpError(400, 'Missing reset token.');
  }
  if (String(password ?? '').length < 8) {
    throw new HttpError(400, 'Passwords need at least 8 characters.');
  }

  await connectDB();
  const user = await User.findOne({ passwordResetTokenHash: hashVerificationToken(token) });

  if (!user) {
    throw new HttpError(400, 'This password reset link is invalid or has already been used.');
  }
  if (!user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
    throw new HttpError(400, 'This password reset link has expired. Request a new one from the sign-in page.');
  }

  // Note: accounts still on the legacy password-derived encryption scheme
  // (encDekWrapped set, no encDekMaster - see serverCrypto.ts) need the old
  // plaintext password to migrate their DEK. A reset here replaces the
  // password without that migration ever having run, so their existing
  // encrypted transaction fields become unreadable. This mirrors the
  // pre-existing limitation of that legacy path rather than introducing a
  // new one; accounts created after the server-managed key shipped are
  // unaffected.
  user.passwordHash = await bcrypt.hash(String(password), 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  // Following the reset link proves control of the inbox, same as the
  // email-verification link does - so this also clears any pending
  // verification requirement.
  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  return ok({ reset: true });
});
