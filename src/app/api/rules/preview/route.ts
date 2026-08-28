import { Account, Transaction } from '@/lib/models';
import { ok, requireUser, route } from '@/lib/api';
import { ruleMatches } from '@/lib/rules';
import { decryptTxFields, getUserDek } from '@/lib/serverCrypto';

const SAMPLE_LIMIT = 50;

/**
 * Dry-runs an in-progress (possibly unsaved) rule draft against this user's
 * uncategorised transactions, so the rule editor can show what it would
 * catch before the user commits to saving it.
 * body: { matchType: 'all' | 'any', conditions: RuleCondition[] }
 */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json().catch(() => ({}));
  const conditions = Array.isArray(body.conditions) ? body.conditions : [];
  const matchType = body.matchType === 'any' ? 'any' : 'all';
  if (!conditions.length) return ok({ total: 0, samples: [] });

  const [accounts, rawTransactions] = await Promise.all([
    Account.find({ userId }).lean(),
    Transaction.find({ userId, categoryId: null }).limit(20000).lean(),
  ]);
  const accountNames = new Map(accounts.map((a) => [String(a._id), a.name]));

  const dek = await getUserDek(userId);
  const transactions = await Promise.all(rawTransactions.map((tx) => decryptTxFields(tx, dek)));

  const matched = transactions.filter((tx) =>
    ruleMatches(
      {
        description: tx.description as string,
        merchant: tx.merchant as string,
        reference: tx.reference as string,
        notes: tx.notes as string,
        amount: tx.amount as number,
        type: tx.type as string,
        accountName: accountNames.get(String(tx.accountId)),
        date: tx.date as Date,
      },
      { name: '', matchType, conditions },
    ),
  );

  return ok({
    total: matched.length,
    samples: matched.slice(0, SAMPLE_LIMIT).map((tx) => ({
      _id: String(tx._id),
      date: tx.date,
      description: tx.description,
      merchant: tx.merchant,
      amount: tx.amount,
      accountId: String(tx.accountId),
    })),
  });
});
