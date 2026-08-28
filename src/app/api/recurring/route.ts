import { Category, Transaction } from '@/lib/models';
import { ok, requireUser, route } from '@/lib/api';
import { normalizeMerchantText } from '@/lib/parse';
import { diceCoefficient } from '@/lib/similarity';
import { decryptField, getUserDek } from '@/lib/serverCrypto';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

// Real statements rarely post a recurring charge on the exact same day or for
// the exact same cent every cycle (weekends, FX rounding, small plan
// add-ons...), so matching needs slack on all three signals instead of an
// exact description key.
const DATE_TOLERANCE_DAYS = 3;
const AMOUNT_ABS_TOLERANCE = 10;
const AMOUNT_REL_TOLERANCE = 0.35;
const TEXT_SIMILARITY_THRESHOLD = 0.5;
// A word that shows up in a big share of a user's own transactions (e.g. a
// generic "Purchase"/"Payment" prefix their bank always adds) carries no
// signal about *which* merchant it is, so it's dropped before comparing -
// otherwise two unrelated payees sharing only that word could look similar.
const COMMON_TOKEN_RATIO = 0.15;

interface RecurringTx {
  _id: unknown;
  description: string;
  amount: number;
  date: Date;
  categoryId: unknown;
  encVersion?: number;
}

interface Cluster {
  members: RecurringTx[];
  signatures: string[][]; // one token signature per member, same order as members
  sumAmount: number;
  gaps: number[];
}

function amountMatches(candidate: number, cluster: Cluster): boolean {
  const avg = cluster.sumAmount / cluster.members.length;
  const tolerance = Math.max(AMOUNT_ABS_TOLERANCE, avg * AMOUNT_REL_TOLERANCE);
  return Math.abs(candidate - avg) <= tolerance;
}

function dateMatches(candidateDate: Date, cluster: Cluster): boolean {
  if (cluster.gaps.length === 0) return true; // no established cadence yet - anything can start one
  const avgGap = cluster.gaps.reduce((a, b) => a + b, 0) / cluster.gaps.length;
  const lastDate = cluster.members[cluster.members.length - 1].date;
  const actualGap = (+candidateDate - +new Date(lastDate)) / DAY;
  return Math.abs(actualGap - avgGap) <= DATE_TOLERANCE_DAYS;
}

/**
 * Finds repeating payments by fuzzy-matching description, amount and date
 * together (rather than requiring byte-identical descriptions), then checking
 * that occurrences land on a consistent schedule. Returns a cadence and the
 * next expected date so upcoming charges are visible before they land.
 */
export const GET = route(async () => {
  const userId = await requireUser();

  const since = new Date(Date.now() - 400 * DAY);
  const [rawTransactions, categories] = await Promise.all([
    Transaction.find({ userId, date: { $gte: since }, type: { $ne: 'transfer' } })
      .sort({ date: 1 })
      .lean() as unknown as Promise<RecurringTx[]>,
    Category.find({ userId }).lean(),
  ]);

  const dek = await getUserDek(userId);
  const transactions = await Promise.all(
    rawTransactions.map(async (tx) => ({
      ...tx,
      description: tx.encVersion === 1 ? await decryptField(dek, tx.description ?? '') : tx.description,
    })),
  );

  const categoryById = new Map(categories.map((c) => [String(c._id), c]));

  // Pass 1: normalize every description and count how many transactions each
  // word appears in, so generic/boilerplate words can be filtered out below.
  const normalized = transactions.map((tx) => {
    const norm = normalizeMerchantText(tx.description ?? '');
    return { tx, tokens: norm.split(' ').filter(Boolean) };
  });
  const docFrequency = new Map<string, number>();
  for (const { tokens } of normalized) {
    for (const t of new Set(tokens)) docFrequency.set(t, (docFrequency.get(t) ?? 0) + 1);
  }
  const total = normalized.length || 1;
  const isCommon = (t: string) => (docFrequency.get(t) ?? 0) / total > COMMON_TOKEN_RATIO;

  // Pass 2: bucket by the rarest surviving word in each description - purely
  // a performance aid to avoid comparing every transaction against every
  // other one. Since it's the least common (most merchant-specific) word,
  // two occurrences of the same real charge should reliably share it even if
  // the rest of the description drifts slightly.
  const buckets = new Map<string, { tx: RecurringTx; signature: string[] }[]>();
  for (const { tx, tokens } of normalized) {
    if (tokens.join(' ').length < 3) continue;
    const signature = tokens.filter((t) => !isCommon(t));
    const effective = signature.length ? signature : tokens;
    const bucketKey = effective.reduce((rarest, t) =>
      (docFrequency.get(t) ?? 0) < (docFrequency.get(rarest) ?? 0) ? t : rarest,
    );
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey)!.push({ tx, signature: effective });
  }

  // Pass 3: within each bucket, greedily grow clusters that agree on
  // description similarity, amount and date cadence all at once.
  const clusters: Cluster[] = [];
  for (const items of buckets.values()) {
    const open: Cluster[] = [];
    for (const { tx, signature } of items) {
      const match = open.find(
        (c) =>
          diceCoefficient(signature, c.signatures[c.signatures.length - 1]) >= TEXT_SIMILARITY_THRESHOLD &&
          amountMatches(Math.abs(tx.amount), c) &&
          dateMatches(tx.date, c),
      );
      if (match) {
        match.gaps.push((+new Date(tx.date) - +new Date(match.members[match.members.length - 1].date)) / DAY);
        match.members.push(tx);
        match.signatures.push(signature);
        match.sumAmount += Math.abs(tx.amount);
      } else {
        open.push({ members: [tx], signatures: [signature], sumAmount: Math.abs(tx.amount), gaps: [] });
      }
    }
    clusters.push(...open);
  }

  const results = [];

  for (const cluster of clusters) {
    const items = cluster.members;
    if (items.length < 3) continue;

    const avgAmount = cluster.sumAmount / items.length;
    if (avgAmount === 0) continue;
    const amounts = items.map((t) => Math.abs(t.amount));
    const amountSpread = Math.max(...amounts) - Math.min(...amounts);
    if (amountSpread > Math.max(AMOUNT_ABS_TOLERANCE * 2, avgAmount * 0.5)) continue;

    const avgGap = cluster.gaps.reduce((a, b) => a + b, 0) / cluster.gaps.length;
    if (avgGap < 5 || avgGap > 190) continue;
    const gapSpread = Math.max(...cluster.gaps) - Math.min(...cluster.gaps);
    if (gapSpread > Math.max(DATE_TOLERANCE_DAYS * 3, avgGap * 0.6)) continue;

    const cadence =
      avgGap < 10 ? 'weekly' : avgGap < 18 ? 'fortnightly' : avgGap < 45 ? 'monthly' : avgGap < 100 ? 'quarterly' : 'twice a year';

    const last = items[items.length - 1];
    const cat = last.categoryId ? categoryById.get(String(last.categoryId)) : null;

    results.push({
      key: String(last._id),
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
