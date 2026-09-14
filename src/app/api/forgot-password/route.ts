import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { isValidEmail } from '@/lib/validation';
import { sendPasswordResetEmail } from '@/lib/email';
import {
  createVerificationToken,
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '@/lib/verification';

export const POST = route(async (req: Request) => {
  const { email } = await req.json();
  const cleanEmail = String(email ?? '')
    .toLowerCase()
    .trim();
  if (!isValidEmail(cleanEmail)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  await connectDB();
  const user = await User.findOne({ email: cleanEmail });

  // Same response whether or not the account exists, so this can't be used
  // to probe which emails are registered.
  if (!user) {
    return ok({ sent: true });
  }

  if (
    user.passwordResetSentAt &&
    Date.now() - user.passwordResetSentAt.getTime() < PASSWORD_RESET_RESEND_COOLDOWN_MS
  ) {
    throw new HttpError(429, 'Wait a minute before requesting another email.');
  }

  const { token, tokenHash } = createVerificationToken();
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  user.passwordResetSentAt = new Date();
  await user.save();

  const resetUrl = new URL(`/reset-password?token=${token}`, req.url).toString();
  await sendPasswordResetEmail(cleanEmail, user.name, resetUrl);

  return ok({ sent: true });
});
