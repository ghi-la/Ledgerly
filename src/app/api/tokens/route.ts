import { ApiToken } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';
import { generateToken } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

const MAX_TOKENS = 10;

/** Personal access tokens (currently only used by the iOS "share to Ledgerly" Shortcut). */
export const GET = route(async () => {
  const userId = await requireUser();
  return ok(await ApiToken.find({ userId }, { tokenHash: 0 }).sort({ createdAt: -1 }).lean());
});

/** Creates a token. The plaintext is returned only in this response - it can't be shown again. */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 60) || 'iPhone';
  if ((await ApiToken.countDocuments({ userId })) >= MAX_TOKENS) {
    throw new HttpError(400, 'You have too many access tokens. Revoke one first.');
  }
  const { token, tokenHash, prefix } = generateToken();
  const doc = await ApiToken.create({ userId, name, tokenHash, prefix });
  return ok({ _id: String(doc._id), name, prefix, token, createdAt: doc.createdAt, lastUsedAt: null }, 201);
});

export const DELETE = route(async (req: Request) => {
  const userId = await requireUser();
  const { id } = await req.json();
  await ApiToken.deleteOne({ _id: oid(id), userId });
  return ok({ deleted: true });
});
