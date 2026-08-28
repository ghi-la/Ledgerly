import crypto from 'crypto';
import { Account, Transaction } from '@/lib/models';
import { HttpError, invalidateStats, ok, oid, requireUser, route } from '@/lib/api';
import { dedupeKey, recurringKey } from '@/lib/parse';
import { encryptTxFields, getUserDek } from '@/lib/serverCrypto';

/** Writes the drafts the user approved in the preview step. */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();

  const accountId = oid(body.accountId);
  if (!accountId) throw new HttpError(400, 'Pick the account these rows belong to.');
  if (!(await Account.exists({ _id: accountId, userId }))) {
    throw new HttpError(404, 'That account no longer exists.');
  }

  const drafts: Record<string, unknown>[] = Array.isArray(body.drafts) ? body.drafts : [];
  if (!drafts.length) throw new HttpError(400, 'Nothing selected to import.');

  const importBatchId = crypto.randomUUID();
  const dek = await getUserDek(userId);

  const docs = await Promise.all(
    drafts
      .filter((d) => d.date && !d.error)
      .map(async (d) => {
        const date = new Date(String(d.date));
        const amount = Number(d.amount);
        const description = String(d.description ?? '').trim();
        const merchant = String(d.merchant ?? '').trim();
        const notes = String(d.notes ?? '').trim();
        const encrypted = await encryptTxFields({ description, merchant, notes }, dek);
        return {
          userId,
          accountId,
          categoryId: oid(d.categoryId),
          date,
          amount,
          description: encrypted.description,
          merchant: encrypted.merchant,
          reference: String(d.reference ?? ''),
          notes: encrypted.notes,
          tags: Array.isArray(d.tags) ? d.tags : [],
          type: d.type ?? (amount >= 0 ? 'income' : 'expense'),
          encVersion: 1,
          importBatchId,
          dedupeKey: dedupeKey(String(accountId), date, amount, description),
          recurringKey: recurringKey(description),
        };
      }),
  );

  if (!docs.length) throw new HttpError(400, 'None of the selected rows could be read.');

  const inserted = await Transaction.insertMany(docs, { ordered: false });

  invalidateStats(userId);
  return ok({ importBatchId, imported: inserted.length }, 201);
});
