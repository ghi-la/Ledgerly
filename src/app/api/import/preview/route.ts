import { Account, Rule, Transaction } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';
import { applyRules } from '@/lib/rules';
import { dedupeKey, parseAmount, parseDate, type DateFormat } from '@/lib/parse';

export interface ImportMapping {
  date?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  merchant?: string;
  reference?: string;
  notes?: string;
}

/**
 * Turns raw CSV records into transaction drafts: parses each column, runs the
 * rule set for a category suggestion, and marks rows already imported.
 */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();

  const accountId = oid(body.accountId);
  if (!accountId) throw new HttpError(400, 'Pick the account these rows belong to.');

  const account = (await Account.findOne({ _id: accountId, userId }).lean()) as { name: string } | null;
  if (!account) throw new HttpError(404, 'That account no longer exists.');

  const rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw new HttpError(400, 'The file has no rows to import.');
  if (rows.length > 20000) throw new HttpError(400, 'That file is too large. Split it in two.');

  const mapping: ImportMapping = body.mapping ?? {};
  if (!mapping.date) throw new HttpError(400, 'Choose which column holds the date.');
  const amountMode: 'single' | 'debit_credit' = body.amountMode ?? 'single';
  if (amountMode === 'single' && !mapping.amount) {
    throw new HttpError(400, 'Choose which column holds the amount.');
  }
  if (amountMode === 'debit_credit' && !mapping.debit && !mapping.credit) {
    throw new HttpError(400, 'Choose the money-out and money-in columns.');
  }

  const dateFormat: DateFormat = body.dateFormat ?? 'auto';
  const decimalSeparator = body.decimalSeparator ?? 'auto';
  const invert = !!body.invertSign;

  const rules = await Rule.find({ userId, enabled: true }).sort({ priority: 1 }).lean();

  const get = (row: Record<string, string>, key?: string) =>
    key ? String(row[key] ?? '').trim() : '';

  const drafts = rows.map((row, index) => {
    const date = parseDate(get(row, mapping.date), dateFormat);
    const description = get(row, mapping.description) || get(row, mapping.merchant) || '—';

    let amount = NaN;
    if (amountMode === 'single') {
      amount = parseAmount(get(row, mapping.amount), decimalSeparator);
    } else {
      const debit = parseAmount(get(row, mapping.debit), decimalSeparator);
      const credit = parseAmount(get(row, mapping.credit), decimalSeparator);
      if (!isNaN(debit) && debit !== 0) amount = -Math.abs(debit);
      else if (!isNaN(credit) && credit !== 0) amount = Math.abs(credit);
      else amount = 0;
    }
    if (invert && !isNaN(amount)) amount = -amount;

    const error = !date
      ? 'Date could not be read'
      : isNaN(amount)
        ? 'Amount could not be read'
        : null;

    const draft = {
      index,
      date: date ? date.toISOString() : null,
      description,
      merchant: get(row, mapping.merchant),
      reference: get(row, mapping.reference),
      notes: get(row, mapping.notes),
      amount: isNaN(amount) ? 0 : amount,
      type: (amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
      categoryId: null as string | null,
      matchedRule: null as string | null,
      tags: [] as string[],
      duplicate: false,
      error,
      dedupeKey: date && !isNaN(amount)
        ? dedupeKey(String(accountId), date, amount, description)
        : null,
    };

    if (!error) {
      const outcome = applyRules(
        {
          description,
          merchant: draft.merchant,
          reference: draft.reference,
          notes: draft.notes,
          amount: draft.amount,
          type: draft.type,
          accountName: account.name,
          date: date!,
        },
        rules as never,
      );
      if (outcome) {
        draft.categoryId = outcome.categoryId ? String(outcome.categoryId) : null;
        draft.matchedRule = outcome.matchedRuleNames[0] ?? null;
        draft.tags = outcome.tags;
        if (outcome.type) draft.type = outcome.type as 'income' | 'expense';
      }
    }

    return draft;
  });

  // Flag rows already in the account, and repeats inside the file itself.
  const keys = drafts.map((d) => d.dedupeKey).filter(Boolean) as string[];
  const existing = new Set(
    (await Transaction.find({ userId, accountId, dedupeKey: { $in: keys } }, { dedupeKey: 1 }).lean())
      .map((t) => t.dedupeKey as string),
  );
  const seen = new Set<string>();
  for (const d of drafts) {
    if (!d.dedupeKey) continue;
    if (existing.has(d.dedupeKey) || seen.has(d.dedupeKey)) d.duplicate = true;
    seen.add(d.dedupeKey);
  }

  return ok({
    drafts,
    stats: {
      total: drafts.length,
      errors: drafts.filter((d) => d.error).length,
      duplicates: drafts.filter((d) => d.duplicate).length,
      categorised: drafts.filter((d) => d.categoryId).length,
      moneyIn: drafts.filter((d) => d.amount > 0).reduce((s, d) => s + d.amount, 0),
      moneyOut: drafts.filter((d) => d.amount < 0).reduce((s, d) => s + d.amount, 0),
    },
  });
});
