import { Transaction } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';
import { recurringKey } from '@/lib/parse';
import { decryptTxFields, encryptField, getUserDek } from '@/lib/serverCrypto';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();

  const set: Record<string, unknown> = {};
  if (body.categoryId !== undefined) set.categoryId = oid(body.categoryId);
  if (body.accountId !== undefined) set.accountId = oid(body.accountId);
  if (body.date !== undefined) set.date = new Date(body.date);
  if (body.amount !== undefined) set.amount = Number(body.amount);
  if (body.reference !== undefined) set.reference = String(body.reference);
  if (body.tags !== undefined) set.tags = body.tags;
  if (body.type !== undefined) set.type = body.type;

  const editsText = body.description !== undefined || body.merchant !== undefined || body.notes !== undefined;
  const dek = await getUserDek(userId);

  if (editsText) {
    let plainDescription: string | undefined;
    if (body.description !== undefined) {
      plainDescription = String(body.description).trim();
      set.description = await encryptField(dek, plainDescription);
    }
    if (body.merchant !== undefined) set.merchant = await encryptField(dek, String(body.merchant).trim());
    if (body.notes !== undefined) set.notes = await encryptField(dek, String(body.notes).trim());
    set.encVersion = 1;
    if (plainDescription !== undefined) set.recurringKey = recurringKey(plainDescription);
  }

  const tx = (await Transaction.findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true }).lean()) as Record<
    string,
    unknown
  > | null;
  if (!tx) throw new HttpError(404, 'That transaction no longer exists.');

  return ok(await decryptTxFields(tx, dek));
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const tx = await Transaction.findOneAndDelete({ _id: id, userId });
  if (!tx) throw new HttpError(404, 'That transaction no longer exists.');
  // Deleting one leg of a transfer removes the matching leg too.
  if (tx.transferId) await Transaction.deleteMany({ userId, transferId: tx.transferId });
  return ok({ deleted: true });
});
