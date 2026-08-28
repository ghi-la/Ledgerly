import { Account, Transaction } from '@/lib/models';
import { invalidateStats, ok, requireUser, route, HttpError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const userId = await requireUser();
  const accounts = await Account.find({ userId }).sort({ archived: 1, name: 1 }).lean();

  const sums = await Transaction.aggregate([
    { $match: { userId } },
    { $group: { _id: '$accountId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const byAccount = new Map(sums.map((s) => [String(s._id), s]));

  return ok(
    accounts.map((a) => {
      const s = byAccount.get(String(a._id));
      return {
        ...a,
        balance: (a.openingBalance ?? 0) + (s?.total ?? 0),
        transactionCount: s?.count ?? 0,
      };
    }),
  );
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();
  if (!body.name?.trim()) throw new HttpError(400, 'Give the account a name.');
  const account = await Account.create({
    userId,
    name: body.name.trim(),
    type: body.type ?? 'checking',
    institution: body.institution ?? '',
    openingBalance: Number(body.openingBalance ?? 0),
    color: body.color ?? '#2E7D6F',
  });
  invalidateStats(userId);
  return ok(account, 201);
});
