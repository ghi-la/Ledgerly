import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { hashVerificationToken } from '@/lib/verification';

export const POST = route(async (req: Request) => {
  const { token } = await req.json();
  if (!token || typeof token !== 'string') {
    throw new HttpError(400, 'Missing verification token.');
  }

  await connectDB();
  const user = await User.findOne({ emailVerificationTokenHash: hashVerificationToken(token) });

  if (!user) {
    throw new HttpError(400, 'This verification link is invalid or has already been used.');
  }
  if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() < Date.now()) {
    throw new HttpError(400, 'This verification link has expired. Request a new one from the sign-in page.');
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  return ok({ verified: true });
});
