import { Account, Budget, Category, Goal, Transaction } from '@/lib/models';
import { ok, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;

/**
 * One call, everything the dashboard needs: balances, category spend, a
 * rolling monthly series, budget progress and goal progress.
 * Query: ?month=YYYY-MM&months=6
 */
export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const month = url.searchParams.get('month') ?? key(new Date());
  const months = Math.min(Math.max(Number(url.searchParams.get('months') ?? 6), 1), 24);

  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));
  const seriesStart = new Date(Date.UTC(y, m - months, 1));

  const [accounts, categories, budgets, goals] = await Promise.all([
    Account.find({ userId }).lean(),
    Category.find({ userId }).lean(),
    Budget.find({ userId }).lean(),
    Goal.find({ userId, archived: false }).lean(),
  ]);

  const [balanceAgg, monthAgg, byCategoryAgg, seriesAgg, merchantsAgg, recent] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId } },
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { userId, date: { $gte: monthStart, $lt: monthEnd }, type: { $ne: 'transfer' } } },
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
      {
        $match: {
          userId,
          date: { $gte: monthStart, $lt: monthEnd },
          type: { $ne: 'transfer' },
          amount: { $lt: 0 },
        },
      },
      { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: 1 } },
    ]),
    Transaction.aggregate([
      { $match: { userId, date: { $gte: seriesStart, $lt: monthEnd }, type: { $ne: 'transfer' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          income: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: monthStart, $lt: monthEnd },
          type: { $ne: 'transfer' },
          amount: { $lt: 0 },
        },
      },
      {
        $group: {
          _id: { $toLower: { $ifNull: ['$merchant', ''] } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          label: { $first: '$description' },
        },
      },
      { $sort: { total: 1 } },
      { $limit: 8 },
    ]),
    Transaction.find({ userId }).sort({ date: -1, _id: -1 }).limit(8).lean(),
  ]);

  const balanceByAccount = new Map(balanceAgg.map((b) => [String(b._id), b.total]));
  const accountRows = accounts.map((a) => ({
    _id: String(a._id),
    name: a.name,
    type: a.type,
    color: a.color,
    archived: a.archived,
    balance: (a.openingBalance ?? 0) + (balanceByAccount.get(String(a._id)) ?? 0),
  }));

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

  // Fill gaps so the trend chart has one point per month.
  const series: { month: string; income: number; expense: number; net: number }[] = [];
  const found = new Map(seriesAgg.map((s) => [s._id as string, s]));
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const k = key(d);
    const row = found.get(k);
    const income = row?.income ?? 0;
    const expense = Math.abs(row?.expense ?? 0);
    series.push({ month: k, income, expense, net: income - expense });
  }

  const spendMap = new Map(spendByCategory.map((s) => [s.categoryId, s.amount]));
  const budgetRows = budgets
    .filter((b) => b.month === 'default' || b.month === month)
    .reduce<Record<string, { amount: number; month: string }>>((acc, b) => {
      const id = String(b.categoryId);
      // A month-specific budget wins over the recurring default.
      if (!acc[id] || b.month === month) acc[id] = { amount: b.amount, month: b.month };
      return acc;
    }, {});

  const budgetProgress = Object.entries(budgetRows).map(([categoryId, b]) => {
    const cat = categoryById.get(categoryId);
    const spent = spendMap.get(categoryId) ?? 0;
    return {
      categoryId,
      name: cat?.name ?? 'Removed category',
      color: cat?.color ?? '#9AA0A6',
      budget: b.amount,
      spent,
      remaining: b.amount - spent,
      percent: b.amount ? Math.round((spent / b.amount) * 100) : 0,
    };
  }).sort((a, b) => b.percent - a.percent);

  const totals = monthAgg[0] ?? { income: 0, expense: 0, count: 0 };

  return ok({
    month,
    netWorth: accountRows.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0),
    accounts: accountRows,
    totals: {
      income: totals.income ?? 0,
      expense: Math.abs(totals.expense ?? 0),
      net: (totals.income ?? 0) + (totals.expense ?? 0),
      count: totals.count ?? 0,
      budgeted: budgetProgress.reduce((s, b) => s + b.budget, 0),
    },
    spendByCategory,
    series,
    budgetProgress,
    goals: goals.map((g) => ({
      _id: String(g._id),
      name: g.name,
      color: g.color,
      targetAmount: g.targetAmount,
      savedAmount: g.accountId
        ? ((accountRows.find((a) => a._id === String(g.accountId))?.balance ?? g.savedAmount))
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
  });
});
