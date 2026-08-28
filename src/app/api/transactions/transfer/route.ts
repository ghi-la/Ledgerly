import crypto from 'crypto';
import { Account, Transaction } from '@/lib/models';
import { HttpError, invalidateStats, ok, oid, requireUser, route } from '@/lib/api';

/** Creates the two matching legs of a transfer between accounts. */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();

  const fromId = oid(body.fromAccountId);
  const toId = oid(body.toAccountId);
  if (!fromId || !toId) throw new HttpError(400, 'Pick both accounts.');
  if (String(fromId) === String(toId)) throw new HttpError(400, 'Pick two different accounts.');

  const amount = Math.abs(Number(body.amount));
  if (!amount) throw new HttpError(400, 'Enter an amount above zero.');
  const date = new Date(body.date);
  if (isNaN(date.getTime())) throw new HttpError(400, 'Enter a valid date.');

  const accounts = await Account.find({ userId, _id: { $in: [fromId, toId] } }).lean();
  if (accounts.length !== 2) throw new HttpError(404, 'One of those accounts no longer exists.');
  const nameOf = (id: unknown) =>
    accounts.find((a) => String(a._id) === String(id))?.name ?? 'account';

  const transferId = crypto.randomUUID();
  const note = String(body.notes ?? '');

  const [out, incoming] = await Transaction.insertMany([
    {
      userId,
      accountId: fromId,
      date,
      amount: -amount,
      description: body.description || `Transfer to ${nameOf(toId)}`,
      type: 'transfer',
      transferId,
      notes: note,
    },
    {
      userId,
      accountId: toId,
      date,
      amount,
      description: body.description || `Transfer from ${nameOf(fromId)}`,
      type: 'transfer',
      transferId,
      notes: note,
    },
  ]);

  invalidateStats(userId);
  return ok({ transferId, out, in: incoming }, 201);
});
