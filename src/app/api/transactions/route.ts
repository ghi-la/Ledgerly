import { Account, Category, Transaction } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';
import { dedupeKey, recurringKey } from '@/lib/parse';
import { buildTransactionFilter } from '@/lib/transactionFilter';
import { decryptTxFields, encryptTxFields, getUserDek } from '@/lib/serverCrypto';

export const dynamic = 'force-dynamic';

const SORTABLE_FIELDS = new Set(['date', 'description', 'amount', 'account', 'category']);
// Bounds how many rows a text search decrypts+scans server-side per request.
const SEARCH_SCAN_CAP = 20000;

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

/**
 * Sorts already-decrypted, in-memory transactions the same way `fetchSorted`
 * orders a Mongo query - used for the text-search path, where pagination
 * happens after decrypting rather than in the database.
 */
async function sortDecrypted(items: Record<string, unknown>[], sortBy: string, sortDir: 1 | -1) {
  if (sortBy === 'account' || sortBy === 'category') {
    const idField = sortBy === 'account' ? 'accountId' : 'categoryId';
    const ids = [...new Set(items.map((i) => String(i[idField])))].filter((id) => id !== 'null');
    const docs = (
      sortBy === 'account'
        ? await Account.find({ _id: { $in: ids } }, { name: 1 }).lean()
        : await Category.find({ _id: { $in: ids } }, { name: 1 }).lean()
    ) as unknown as { _id: unknown; name: string }[];
    const nameById = new Map(docs.map((d) => [String(d._id), d.name]));
    items.sort((a, b) => sortDir * (nameById.get(String(a[idField])) ?? '').localeCompare(nameById.get(String(b[idField])) ?? ''));
    return;
  }
  items.sort((a, b) => {
    const av = a[sortBy] as string | number | Date | null;
    const bv = b[sortBy] as string | number | Date | null;
    if (av == null && bv == null) return 0;
    if (av == null) return -sortDir;
    if (bv == null) return sortDir;
    if (av < bv) return -sortDir;
    if (av > bv) return sortDir;
    return 0;
  });
}

export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams;

  const filter = await buildTransactionFilter(userId, q);

  const limit = Math.min(Number(q.get('limit') ?? 100), 500);
  const skip = Number(q.get('skip') ?? 0);

  const sortByParam = q.get('sortBy') ?? 'date';
  const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : 'date';
  const sortDir = q.get('sortDir') === 'asc' ? 1 : -1;

  const dek = await getUserDek(userId);
  const search = q.get('search')?.trim();

  let items: Record<string, unknown>[];
  let total: number;

  if (search) {
    // description/merchant/notes are encrypted with a random IV per write, so
    // they can never match a Mongo query - decrypt every structurally-filtered
    // candidate and filter/sort/paginate in application code instead.
    const candidates = await Transaction.find(filter).limit(SEARCH_SCAN_CAP).lean();
    const decrypted = await Promise.all(candidates.map((tx) => decryptTxFields(tx, dek)));
    const needle = search.toLowerCase();
    const matched = decrypted.filter((t) =>
      [t.description, t.merchant, t.notes, t.reference].some((f) => String(f ?? '').toLowerCase().includes(needle)),
    );
    await sortDecrypted(matched, sortBy, sortDir);
    total = matched.length;
    items = matched.slice(skip, skip + limit);
  } else {
    const [page, count] = await Promise.all([
      fetchSorted(filter, sortBy, sortDir, skip, limit),
      Transaction.countDocuments(filter),
    ]);
    items = await Promise.all(page.map((tx) => decryptTxFields(tx, dek)));
    total = count;
  }

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

  const description = String(body.description ?? '').trim();
  const merchant = String(body.merchant ?? '').trim();
  const notes = String(body.notes ?? '').trim();

  const dek = await getUserDek(userId);
  const encrypted = await encryptTxFields({ description, merchant, notes }, dek);

  const tx = await Transaction.create({
    userId,
    accountId,
    categoryId: oid(body.categoryId),
    date,
    amount,
    description: encrypted.description,
    merchant: encrypted.merchant,
    reference: body.reference ?? '',
    notes: encrypted.notes,
    tags: body.tags ?? [],
    type: body.type ?? (amount >= 0 ? 'income' : 'expense'),
    encVersion: 1,
    dedupeKey: dedupeKey(String(accountId), date, amount, description),
    recurringKey: recurringKey(description),
  });

  return ok({ ...tx.toObject(), description, merchant, notes }, 201);
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
