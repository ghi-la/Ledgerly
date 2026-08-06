import { Category, Transaction } from '@/lib/models';
import { ok, requireUser, route } from '@/lib/api';
import { recurringKey } from '@/lib/parse';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

/**
 * Finds repeating payments by grouping similar descriptions and checking that
 * the gaps between them are consistent. Returns a cadence and the next
 * expected date so upcoming charges are visible before they land.
 */
export const GET = route(async () => {
  const userId = await requireUser();

  const since = new Date(Date.now() - 400 * DAY);
  const [transactions, categories] = await Promise.all([
    Transaction.find({ userId, date: { $gte: since }, type: { $ne: 'transfer' } })
      .sort({ date: 1 })
      .lean(),
    Category.find({ userId }).lean(),
  ]);

  const categoryById = new Map(categories.map((c) => [String(c._id), c]));
  const groups = new Map<string, typeof transactions>();

  for (const tx of transactions) {
    const k = tx.recurringKey || recurringKey(tx.description ?? '');
    if (!k || k.length < 3) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(tx);
  }

  const results = [];

  for (const [k, items] of groups) {
    if (items.length < 3) continue;

    const amounts = items.map((t) => Math.abs(t.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avgAmount === 0) continue;
    const spread = Math.max(...amounts) - Math.min(...amounts);
    if (spread / avgAmount > 0.35) continue; // amounts vary too much to be a subscription

    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
      gaps.push((+new Date(items[i].date) - +new Date(items[i - 1].date)) / DAY);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 5 || avgGap > 190) continue;
    const gapSpread = Math.max(...gaps) - Math.min(...gaps);
    if (gapSpread > Math.max(8, avgGap * 0.45)) continue;

    const cadence =
      avgGap < 10 ? 'weekly' : avgGap < 18 ? 'fortnightly' : avgGap < 45 ? 'monthly' : avgGap < 100 ? 'quarterly' : 'twice a year';

    const last = items[items.length - 1];
    const cat = last.categoryId ? categoryById.get(String(last.categoryId)) : null;

    results.push({
      key: k,
      label: last.description,
      cadence,
      averageGapDays: Math.round(avgGap),
      averageAmount: Math.round(avgAmount * 100) / 100,
      direction: last.amount < 0 ? 'out' : 'in',
      occurrences: items.length,
      lastDate: last.date,
      nextExpected: new Date(+new Date(last.date) + avgGap * DAY),
      categoryId: cat ? String(cat._id) : null,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
    });
  }

  results.sort((a, b) => +new Date(a.nextExpected) - +new Date(b.nextExpected));

  const monthlyOut = results
    .filter((r) => r.direction === 'out')
    .reduce((s, r) => s + (r.averageAmount * 30) / r.averageGapDays, 0);

  return ok({ items: results, monthlyEquivalentOut: Math.round(monthlyOut * 100) / 100 });
});
