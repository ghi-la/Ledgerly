import crypto from 'crypto';
import { Account, Transaction } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';
import { dedupeKey, recurringKey } from '@/lib/parse';

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

  const docs = drafts
    .filter((d) => d.date && !d.error)
    .map((d) => {
      const date = new Date(String(d.date));
      const amount = Number(d.amount);
      // `description` may already be ciphertext (encVersion 1); `plainDescription`
      // carries the plaintext just for this request, used only to compute the
      // dedupe/recurring fingerprints below — it's never persisted.
      const description = String(d.description ?? '').trim();
      const plainDescription = String(d.plainDescription ?? d.description ?? '').trim();
      return {
        userId,
        accountId,
        categoryId: oid(d.categoryId),
        date,
        amount,
        description,
        merchant: String(d.merchant ?? ''),
        reference: String(d.reference ?? ''),
        notes: String(d.notes ?? ''),
        tags: Array.isArray(d.tags) ? d.tags : [],
        type: d.type ?? (amount >= 0 ? 'income' : 'expense'),
        encVersion: d.encVersion === 1 ? 1 : 0,
        importBatchId,
        dedupeKey: dedupeKey(String(accountId), date, amount, plainDescription),
        recurringKey: recurringKey(plainDescription),
      };
    });

  if (!docs.length) throw new HttpError(400, 'None of the selected rows could be read.');

  const inserted = await Transaction.insertMany(docs, { ordered: false });

  return ok({ importBatchId, imported: inserted.length }, 201);
});
