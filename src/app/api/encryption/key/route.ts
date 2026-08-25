import { User } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';

/** Fetches the signed-in user's wrapped data-encryption key (DEK). */
export const GET = route(async () => {
  const userId = await requireUser();
  const user = (await User.findById(userId, { encSalt: 1, encDekWrapped: 1, encDekIv: 1 }).lean()) as {
    encSalt?: string | null;
    encDekWrapped?: string | null;
    encDekIv?: string | null;
  } | null;
  if (!user) throw new HttpError(404, 'Account not found.');
  return ok({
    encSalt: user.encSalt ?? null,
    encDekWrapped: user.encDekWrapped ?? null,
    encDekIv: user.encDekIv ?? null,
  });
});

/**
 * Stores a (re)wrapped DEK. Used to bootstrap encryption for accounts created
 * before this feature shipped, the first time they log in.
 */
export const PATCH = route(async (req: Request) => {
  const userId = await requireUser();
  const { encSalt, encDekWrapped, encDekIv } = await req.json();
  if (!encSalt || !encDekWrapped || !encDekIv) {
    throw new HttpError(400, 'Missing encryption key material.');
  }
  await User.updateOne(
    { _id: userId },
    { $set: { encSalt: String(encSalt), encDekWrapped: String(encDekWrapped), encDekIv: String(encDekIv) } },
  );
  return ok({ ok: true });
});
