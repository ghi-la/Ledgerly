import { unstable_cache } from 'next/cache';
import mongoose from 'mongoose';
import { Account, Budget, Category, Goal, Transaction } from '@/lib/models';
import { ok, requireUser, route } from '@/lib/api';
import { decryptTxFields, getUserDek } from '@/lib/serverCrypto';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');
const monthKeyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;

/** Every calendar month touched by [from, to], oldest first. */
function monthsBetween(from: Date, to: Date) {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end) {
    keys.push(monthKeyOf(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/** Sums each category's applicable monthly budget (month-specific overrides the recurring default) across every month in range. */
function budgetTotalsByCategory(budgets: Record<string, unknown>[], monthKeys: string[]) {
  const totals = new Map<string, number>();
  for (const monthKey of monthKeys) {
    const byCategory = new Map<string, number>();
    for (const b of budgets) {
      const month = String(b.month);
      if (month !== 'default' && month !== monthKey) continue;
      const id = String(b.categoryId);
      if (!byCategory.has(id) || month === monthKey) byCategory.set(id, Number(b.amount));
    }
    for (const [id, amount] of byCategory) totals.set(id, (totals.get(id) ?? 0) + amount);
  }
  return totals;
}

/**
 * Everything one dashboard widget needs for its own time window: balances
 * (always current), category spend, a monthly series, budget progress and
 * goal progress. Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults to the
 * trailing 3 months ending today), optionally &accounts=id1,id2 to scope a
 * widget to a subset of accounts (transactions, balances and totals only -
 * budgets/goals aren't account-scoped, so they're unaffected).
 */
async function computeStats(
  userIdStr: string,
  fromParam: string | null,
  toParam: string | null,
  accountsParam: string | null,
) {
  // aggregate() $match doesn't auto-cast like find() does, so the cache key's
  // plain string needs converting back to an ObjectId before use in queries.
  const userId = new mongoose.Types.ObjectId(userIdStr);
  const accountIds = accountsParam ? accountsParam.split(',').filter(Boolean) : null;
  const accountObjectIds = accountIds?.map((id) => new mongoose.Types.ObjectId(id)) ?? null;
  const accountMatch = accountObjectIds ? { accountId: { $in: accountObjectIds } } : {};
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : now;

  const [accounts, categories, budgets, goals, oldestTx] = await Promise.all([
    Account.find({ userId }).lean(),
    Category.find({ userId }).lean(),
    Budget.find({ userId }).lean(),
    Goal.find({ userId, archived: false }).lean(),
    // "all time" resolves to the user's actual earliest transaction, not an arbitrary fixed date.
    fromParam === 'oldest'
      ? Transaction.findOne({ userId }).sort({ date: 1 }).select('date').lean()
      : Promise.resolve(null),
  ]);

  const from =
    fromParam === 'oldest'
      ? new Date((oldestTx as { date: Date } | null)?.date ?? to)
      : fromParam
        ? new Date(fromParam)
        : defaultFrom;

  const monthKeys = monthsBetween(from, to);

  const [balanceAgg, totalsAgg, byCategoryAgg, seriesAgg, expenseRows, recentRaw] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId } },
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { userId, date: { $gte: from, $lte: to }, type: { $ne: 'transfer' }, ...accountMatch } },
      {
        $group: {
          _id: null,
          income: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { userId, date: { $gte: from, $lte: to }, type: { $ne: 'transfer' }, amount: { $lt: 0 }, ...accountMatch } },
      { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: 1 } },
    ]),
    Transaction.aggregate([
      { $match: { userId, date: { $gte: from, $lte: to }, type: { $ne: 'transfer' }, ...accountMatch } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          income: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // merchant/description are encrypted, so grouping by merchant text can't
    // happen in the database - fetch the candidate rows and group them in
    // application code below, after decrypting.
    Transaction.find(
      { userId, date: { $gte: from, $lte: to }, type: { $ne: 'transfer' }, amount: { $lt: 0 }, ...accountMatch },
      { merchant: 1, description: 1, amount: 1, encVersion: 1 },
    ).lean(),
    Transaction.find({ userId, date: { $gte: from, $lte: to }, ...accountMatch }).sort({ date: -1, _id: -1 }).limit(8).lean(),
  ]);

  const dek = await getUserDek(userId);
  const decryptedExpenses = await Promise.all(expenseRows.map((t) => decryptTxFields(t, dek)));
  const recent = await Promise.all(recentRaw.map((t) => decryptTxFields(t, dek)));

  const merchantGroups = new Map<string, { total: number; count: number; merchantKey: string; firstDescription: string }>();
  for (const t of decryptedExpenses) {
    const merchant = (t.merchant as string) ?? '';
    const amount = t.amount as number;
    const merchantKey = merchant.toLowerCase();
    const existing = merchantGroups.get(merchantKey);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      merchantGroups.set(merchantKey, { total: amount, count: 1, merchantKey, firstDescription: (t.description as string) ?? '' });
    }
  }
  const merchantsAgg = [...merchantGroups.values()]
    .sort((a, b) => a.total - b.total)
    .slice(0, 8)
    .map((g) => ({ _id: g.merchantKey, label: g.firstDescription, total: g.total, count: g.count }));

  const balanceByAccount = new Map(balanceAgg.map((b) => [String(b._id), b.total]));
  // Kept unfiltered - goal-linked balances and the recent-transactions
  // account name lookup below should resolve regardless of this request's
  // own account filter (that filter only scopes this widget's own totals).
  const accountRows = accounts.map((a) => ({
    _id: String(a._id),
    name: a.name,
    type: a.type,
    color: a.color,
    archived: a.archived,
    balance: (a.openingBalance ?? 0) + (balanceByAccount.get(String(a._id)) ?? 0),
  }));
  const visibleAccountRows = accountIds ? accountRows.filter((a) => accountIds.includes(a._id)) : accountRows;

  const categoryById = new Map(categories.map((c) => [String(c._id), c]));

  const spendByCategory = byCategoryAgg.map((row) => {
    const cat = row._id ? categoryById.get(String(row._id)) : null;
    return {
      categoryId: row._id ? String(row._id) : null,
      name: cat?.name ?? 'Uncategorised',
      color: cat?.color ?? '#9AA0A6',
      amount: Math.abs(row.total),
      count: row.count,
    };
  });

  // Rolls each subcategory's spend into its parent, for the dashboard's
  // expandable category widget - `spendByCategory` above stays leaf-level
  // and unrolled, since the budgets page needs each category's own exact spend.
  const leafByCategory = new Map(spendByCategory.map((s) => [s.categoryId, s]));
  const childIdsByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const pid = String(c.parentId);
    if (!childIdsByParent.has(pid)) childIdsByParent.set(pid, []);
    childIdsByParent.get(pid)!.push(String(c._id));
  }

  const categorySpend: {
    categoryId: string | null;
    name: string;
    color: string;
    amount: number;
    count: number;
    subcategories: { categoryId: string; name: string; color: string; amount: number; count: number }[];
  }[] = [];

  for (const c of categories) {
    if (c.parentId) continue; // folded into its parent below
    const id = String(c._id);
    const own = leafByCategory.get(id);
    const subcategories = (childIdsByParent.get(id) ?? [])
      .map((cid) => leafByCategory.get(cid))
      .filter((s): s is NonNullable<typeof s> => !!s && s.amount > 0)
      .map((s) => ({ categoryId: s.categoryId as string, name: s.name, color: s.color, amount: s.amount, count: s.count }))
      .sort((a, b) => b.amount - a.amount);
    const amount = (own?.amount ?? 0) + subcategories.reduce((sum, s) => sum + s.amount, 0);
    const count = (own?.count ?? 0) + subcategories.reduce((sum, s) => sum + s.count, 0);
    if (amount > 0) categorySpend.push({ categoryId: id, name: c.name, color: c.color, amount, count, subcategories });
  }
  const uncategorised = leafByCategory.get(null);
  if (uncategorised) categorySpend.push({ ...uncategorised, categoryId: null, subcategories: [] });
  categorySpend.sort((a, b) => b.amount - a.amount);

  // Fill gaps so the trend chart has one point per month in range.
  const foundSeries = new Map(seriesAgg.map((s) => [s._id as string, s]));
  const series = monthKeys.map((k) => {
    const row = foundSeries.get(k);
    const income = row?.income ?? 0;
    const expense = Math.abs(row?.expense ?? 0);
    return { month: k, income, expense, net: income - expense };
  });

  const spendMap = new Map(spendByCategory.map((s) => [s.categoryId, s.amount]));
  const budgetTotals = budgetTotalsByCategory(budgets, monthKeys);
  const budgetProgress = [...budgetTotals.entries()]
    .map(([categoryId, budget]) => {
      const cat = categoryById.get(categoryId);
      const spent = spendMap.get(categoryId) ?? 0;
      return {
        categoryId,
        name: cat?.name ?? 'Removed category',
        color: cat?.color ?? '#9AA0A6',
        budget,
        spent,
        remaining: budget - spent,
        percent: budget ? Math.round((spent / budget) * 100) : 0,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  const totals = totalsAgg[0] ?? { income: 0, expense: 0, count: 0 };

  const payload = {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    netWorth: visibleAccountRows.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0),
    accounts: visibleAccountRows,
    totals: {
      income: totals.income ?? 0,
      expense: Math.abs(totals.expense ?? 0),
      net: (totals.income ?? 0) + (totals.expense ?? 0),
      count: totals.count ?? 0,
      budgeted: budgetProgress.reduce((s, b) => s + b.budget, 0),
    },
    spendByCategory,
    categorySpend,
    series,
    budgetProgress,
    goals: goals.map((g) => ({
      _id: String(g._id),
      name: g.name,
      color: g.color,
      targetAmount: g.targetAmount,
      savedAmount: g.accountId
        ? (accountRows.find((a) => a._id === String(g.accountId))?.balance ?? g.savedAmount)
        : g.savedAmount,
      targetDate: g.targetDate,
      linkedAccount: g.accountId ? String(g.accountId) : null,
    })),
    topMerchants: merchantsAgg.map((r) => ({
      name: r._id || r.label || 'Unnamed',
      amount: Math.abs(r.total),
      count: r.count,
    })),
    recent: recent.map((t) => ({
      _id: String(t._id),
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      categoryId: t.categoryId ? String(t.categoryId) : null,
      categoryName: t.categoryId ? (categoryById.get(String(t.categoryId))?.name ?? null) : null,
      categoryColor: t.categoryId ? (categoryById.get(String(t.categoryId))?.color ?? null) : null,
      accountName: accountRows.find((a) => a._id === String(t.accountId))?.name ?? '',
    })),
  };

  return payload;
}

// Reuses Next.js's Data Cache (Vercel-backed in production, so it's shared
// across serverless invocations - a plain in-memory cache wouldn't be, since
// concurrent requests can land on different function instances). Tagged per
// user so writes can invalidate this user's entry on demand via
// `invalidateStats` instead of only waiting out `revalidate`.
export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  // Normalised so equivalent sets (any order) share the same cache entry.
  const accountsParam = url.searchParams.get('accounts');
  const normalisedAccountsParam = accountsParam
    ? accountsParam.split(',').filter(Boolean).sort().join(',') || null
    : null;

  const userIdStr = userId.toString();
  const getCachedStats = unstable_cache(computeStats, ['stats-v2'], {
    revalidate: 20,
    tags: [`stats:${userIdStr}`],
  });
  const payload = await getCachedStats(userIdStr, fromParam, toParam, normalisedAccountsParam);
  return ok(payload);
});
