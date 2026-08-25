import { Account, Category, Transaction } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';
import { dedupeKey, recurringKey } from '@/lib/parse';
import { buildTransactionFilter } from '@/lib/transactionFilter';

export const dynamic = 'force-dynamic';

const SORTABLE_FIELDS = new Set(['date', 'description', 'amount', 'account', 'category']);

function fetchSorted(
  filter: Record<string, unknown>,
  sortBy: string,
  sortDir: 1 | -1,
  skip: number,
  limit: number,
) {
  if (sortBy !== 'account' && sortBy !== 'category') {
    return Transaction.find(filter).sort({ [sortBy]: sortDir, _id: sortDir }).skip(skip).limit(limit).lean();
  }
  const from = sortBy === 'account' ? Account.collection.name : Category.collection.name;
  const localField = sortBy === 'account' ? 'accountId' : 'categoryId';
  return Transaction.aggregate([
    { $match: filter },
    { $lookup: { from, localField, foreignField: '_id', as: '_sortJoin' } },
    { $addFields: { _sortName: { $ifNull: [{ $arrayElemAt: ['$_sortJoin.name', 0] }, ''] } } },
    { $sort: { _sortName: sortDir, _id: sortDir } },
    { $skip: skip },
    { $limit: limit },
    { $project: { _sortJoin: 0, _sortName: 0 } },
  ]);
}

/**
 * Attaches each transaction's running balance in its own account's full
 * chronological ledger (seeded by the account's opening balance); the real
 * point-in-time balance, independent of whatever filter/sort produced `items`.
 */
async function attachBalances(userId: unknown, items: Record<string, unknown>[]) {
  if (!items.length) return;
  const accountIds = [...new Set(items.map((i) => String(i.accountId)))].map((id) => oid(id));
  const txIds = items.map((i) => i._id);

  const [accounts, running] = await Promise.all([
    Account.find({ _id: { $in: accountIds } }, { openingBalance: 1 }).lean(),
    Transaction.aggregate([
      { $match: { userId, accountId: { $in: accountIds } } },
      {
        $setWindowFields: {
          partitionBy: '$accountId',
          sortBy: { date: 1, _id: 1 },
          output: { runningTotal: { $sum: '$amount', window: { documents: ['unbounded', 'current'] } } },
        },
      },
      { $match: { _id: { $in: txIds } } },
      { $project: { runningTotal: 1 } },
    ]),
  ]);

  const openingByAccount = new Map(accounts.map((a) => [String(a._id), a.openingBalance ?? 0]));
  const runningByTx = new Map(running.map((r) => [String(r._id), r.runningTotal]));

  for (const item of items) {
    const opening = openingByAccount.get(String(item.accountId)) ?? 0;
    const runningTotal = runningByTx.get(String(item._id)) ?? 0;
    item.balance = opening + runningTotal;
  }
}

export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams;

  const filter = buildTransactionFilter(userId, q);

  const limit = Math.min(Number(q.get('limit') ?? 100), 500);
  const skip = Number(q.get('skip') ?? 0);

  const sortByParam = q.get('sortBy') ?? 'date';
  const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : 'date';
  const sortDir = q.get('sortDir') === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    fetchSorted(filter, sortBy, sortDir, skip, limit),
    Transaction.countDocuments(filter),
  ]);
  await attachBalances(userId, items);

  return ok({ items, total, limit, skip });
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();

  const accountId = oid(body.accountId);
  if (!accountId) throw new HttpError(400, 'Pick an account.');
  const amount = Number(body.amount);
  if (!isFinite(amount)) throw new HttpError(400, 'Enter a valid amount.');
  const date = new Date(body.date);
  if (isNaN(date.getTime())) throw new HttpError(400, 'Enter a valid date.');

  // `description` may already be ciphertext (encVersion 1); `plainDescription`
  // carries the plaintext just for this request, used only to compute the
  // dedupe fingerprint below (a one-way hash, never persisted as-is). Once
  // encrypted, `recurringKey` stays null rather than storing a readable
  // snippet of the description in the clear: same trade-off already made for
  // "top merchants" in the stats route, which excludes encrypted rows from
  // its plaintext-grouping instead of leaking a fragment to enable it.
  const description = String(body.description ?? '').trim();
  const plainDescription = String(body.plainDescription ?? body.description ?? '').trim();
  const encVersion = body.encVersion === 1 ? 1 : 0;

  const tx = await Transaction.create({
    userId,
    accountId,
    categoryId: oid(body.categoryId),
    date,
    amount,
    description,
    merchant: body.merchant ?? '',
    reference: body.reference ?? '',
    notes: body.notes ?? '',
    tags: body.tags ?? [],
    type: body.type ?? (amount >= 0 ? 'income' : 'expense'),
    encVersion,
    dedupeKey: dedupeKey(String(accountId), date, amount, plainDescription),
    recurringKey: encVersion === 1 ? null : recurringKey(plainDescription),
  });

  return ok(tx, 201);
});

export const DELETE = route(async (req: Request) => {
  const userId = await requireUser();
  const { ids, importBatchId } = await req.json();

  if (importBatchId) {
    const res = await Transaction.deleteMany({ userId, importBatchId });
    return ok({ deleted: res.deletedCount ?? 0 });
  }
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Select transactions first.');
  const res = await Transaction.deleteMany({ userId, _id: { $in: ids } });
  return ok({ deleted: res.deletedCount ?? 0 });
});
