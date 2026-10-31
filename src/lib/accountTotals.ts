import { unstable_cache } from 'next/cache';
import mongoose from 'mongoose';
import { Transaction } from './models';

export type AccountTotals = Record<string, { total: number; count: number }>;

async function computeAccountTotals(userIdStr: string): Promise<AccountTotals> {
  const rows = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userIdStr) } },
    { $group: { _id: '$accountId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), { total: r.total, count: r.count }]));
}

/**
 * Sum and count of every transaction per account, for the signed-in user.
 * Grouping the whole history is the costliest query behind balances, so it's
 * cached under the same `stats:<userId>` tag that every transaction write
 * already invalidates via `invalidateStats` - the TTL is only a safety net.
 */
export function getAccountTotals(userId: unknown) {
  const userIdStr = String(userId);
  return unstable_cache(computeAccountTotals, ['account-totals-v1'], {
    revalidate: 300,
    tags: [`stats:${userIdStr}`],
  })(userIdStr);
}
