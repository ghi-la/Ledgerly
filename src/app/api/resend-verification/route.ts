import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { isValidEmail } from '@/lib/validation';
import { sendVerificationEmail } from '@/lib/email';
import {
  createVerificationToken,
  VERIFICATION_RESEND_COOLDOWN_MS,
  VERIFICATION_TOKEN_TTL_MS,
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
  if (!user || user.emailVerified) {
    return ok({ sent: true });
  }

  if (
    user.emailVerificationSentAt &&
    Date.now() - user.emailVerificationSentAt.getTime() < VERIFICATION_RESEND_COOLDOWN_MS
  ) {
    throw new HttpError(429, 'Wait a minute before requesting another email.');
  }

  const { token, tokenHash } = createVerificationToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  user.emailVerificationSentAt = new Date();
  await user.save();

  const verifyUrl = new URL(`/verify-email?token=${token}`, req.url).toString();
  await sendVerificationEmail(cleanEmail, user.name, verifyUrl);

  return ok({ sent: true });
});
