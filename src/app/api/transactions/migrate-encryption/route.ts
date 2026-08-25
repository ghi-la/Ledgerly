import { Transaction } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';

/** Returns a batch of the signed-in user's transactions that still have plaintext description/merchant/notes. */
export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 200), 500);
  const items = await Transaction.find(
    { userId, encVersion: { $ne: 1 } },
    { description: 1, merchant: 1, notes: 1 },
  )
    .limit(limit)
    .lean();
  return ok({ items });
});

/** Writes back a batch of client-encrypted replacements, flipping encVersion to 1. */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const { items } = await req.json();
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Nothing to migrate.');

  await Promise.all(
    items.map((item: { id: string; description: string; merchant: string; notes: string }) =>
      Transaction.updateOne(
        { _id: item.id, userId },
        {
          $set: {
            description: item.description,
            merchant: item.merchant,
            notes: item.notes,
            encVersion: 1,
            // The old plaintext-derived recurringKey (if any) is a snippet
            // of the description we're encrypting right now, so it can't
            // survive the migration either.
            recurringKey: null,
          },
        },
      ),
    ),
  );

  return ok({ updated: items.length });
});
