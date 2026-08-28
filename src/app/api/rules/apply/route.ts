import { Account, Rule, Transaction } from '@/lib/models';
import { invalidateStats, ok, oid, requireUser, route } from '@/lib/api';
import { applyRules } from '@/lib/rules';
import { decryptTxFields, encryptField, getUserDek } from '@/lib/serverCrypto';

const MAX_RETURNED_PAIRS = 200;

/**
 * Re-runs the rule set over transactions already in the database.
 * body: { onlyUncategorised?: boolean, ruleId?: string, dryRun?: boolean }
 */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json().catch(() => ({}));
  const onlyUncategorised = body.onlyUncategorised ?? true;
  const dryRun = !!body.dryRun;

  const ruleFilter: Record<string, unknown> = { userId, enabled: true };
  if (oid(body.ruleId)) ruleFilter._id = oid(body.ruleId);

  const [rules, accounts] = await Promise.all([
    Rule.find(ruleFilter).sort({ priority: 1 }).lean(),
    Account.find({ userId }).lean(),
  ]);
  if (!rules.length) return ok({ scanned: 0, matched: 0, updated: 0, samples: [], updatedTransactions: [] });

  const accountNames = new Map(accounts.map((a) => [String(a._id), a.name]));

  const txFilter: Record<string, unknown> = { userId };
  if (onlyUncategorised) txFilter.categoryId = null;
  const rawTransactions = await Transaction.find(txFilter).limit(20000).lean();

  const dek = await getUserDek(userId);
  const transactions = await Promise.all(rawTransactions.map((tx) => decryptTxFields(tx, dek)));

  const writes: Record<string, unknown>[] = [];
  const samples: unknown[] = [];
  // Every transaction the rule set actually touches, before/after - not just
  // ones the caller happened to have loaded - so the UI can surface every
  // affected row, not only the one the user was looking at when they triggered this.
  const updatedPairs: { before: Record<string, unknown>; after: Record<string, unknown> }[] = [];
  let matched = 0;

  for (const tx of transactions) {
    const outcome = applyRules(
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
      rules as never,
    );
    if (!outcome) continue;
    matched++;

    const set: Record<string, unknown> = {};
    if (outcome.categoryId) set.categoryId = outcome.categoryId;
    if (outcome.type) set.type = outcome.type;
    if (outcome.merchant) set.merchant = await encryptField(dek, outcome.merchant);
    if (outcome.notes) set.notes = await encryptField(dek, outcome.notes);
    if (outcome.matchedRuleIds.length) set.appliedRuleId = outcome.matchedRuleIds[0];
    if (!Object.keys(set).length) continue;

    if (samples.length < 20) {
      samples.push({
        description: tx.description,
        amount: tx.amount,
        rule: outcome.matchedRuleNames[0],
        categoryId: outcome.categoryId ? String(outcome.categoryId) : null,
      });
    }

    writes.push({
      updateOne: {
        filter: { _id: tx._id, userId },
        update: {
          $set: set,
          ...(outcome.tags.length && { $addToSet: { tags: { $each: outcome.tags } } }),
        },
      },
    });

    if (!dryRun && updatedPairs.length < MAX_RETURNED_PAIRS) {
      const before = {
        _id: String(tx._id),
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant,
        notes: tx.notes,
        reference: tx.reference,
        amount: tx.amount,
        type: tx.type,
        accountId: String(tx.accountId),
        categoryId: tx.categoryId ? String(tx.categoryId) : null,
        tags: (tx.tags as string[] | undefined) ?? [],
      };
      updatedPairs.push({
        before,
        after: {
          ...before,
          categoryId: outcome.categoryId ? String(outcome.categoryId) : before.categoryId,
          type: outcome.type ?? before.type,
          merchant: outcome.merchant ?? before.merchant,
          notes: outcome.notes ?? before.notes,
          tags: outcome.tags.length ? Array.from(new Set([...before.tags, ...outcome.tags])) : before.tags,
        },
      });
    }
  }

  if (!dryRun && writes.length) {
    await Transaction.bulkWrite(writes as never);
    invalidateStats(userId);
  }

  return ok({
    scanned: transactions.length,
    matched,
    updated: dryRun ? 0 : writes.length,
    dryRun,
    samples,
    updatedTransactions: dryRun ? [] : updatedPairs,
  });
});
