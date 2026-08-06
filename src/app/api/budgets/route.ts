import { Budget } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const userId = await requireUser();
  return ok(await Budget.find({ userId }).lean());
});

/** Upserts one budget line. Amount 0 removes it. */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();
  const categoryId = oid(body.categoryId);
  if (!categoryId) throw new HttpError(400, 'Pick a category.');
  const month = String(body.month ?? 'default');
  const amount = Number(body.amount);
  if (!isFinite(amount) || amount < 0) throw new HttpError(400, 'Enter an amount of zero or more.');

  if (amount === 0) {
    await Budget.deleteOne({ userId, categoryId, month });
    return ok({ deleted: true });
  }

  const budget = await Budget.findOneAndUpdate(
    { userId, categoryId, month },
    { $set: { amount } },
    { upsert: true, new: true },
  );
  return ok(budget);
});
