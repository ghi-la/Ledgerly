import { Transaction } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';
import { dedupeKey, recurringKey } from '@/lib/parse';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams;

  const filter: Record<string, unknown> = { userId };

  const accountId = oid(q.get('accountId'));
  if (accountId) filter.accountId = accountId;

  const categoryParam = q.get('categoryId');
  if (categoryParam === 'none') filter.categoryId = null;
  else if (oid(categoryParam)) filter.categoryId = oid(categoryParam);

  if (q.get('type')) filter.type = q.get('type');

  const from = q.get('from');
  const to = q.get('to');
  if (from || to) {
    filter.date = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(`${to}T23:59:59.999Z`) }),
    };
  }

  const search = q.get('search')?.trim();
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ description: rx }, { merchant: rx }, { notes: rx }, { reference: rx }];
  }

  const limit = Math.min(Number(q.get('limit') ?? 100), 500);
  const skip = Number(q.get('skip') ?? 0);

  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments(filter),
  ]);

  return ok({ items, total, limit, skip });
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();

  const accountId = oid(body.accountId);
  if (!accountId) throw new HttpError(400, 'Pick an account.');
  const amount = Number(body.amount);
  if (!isFinite(amount)) throw new HttpError(400, 'Enter a valid amount.');
  const date = new Date(body.date);
  if (isNaN(date.getTime())) throw new HttpError(400, 'Enter a valid date.');

  const description = String(body.description ?? '').trim();

  const tx = await Transaction.create({
    userId,
    accountId,
    categoryId: oid(body.categoryId),
    date,
    amount,
    description,
    merchant: body.merchant ?? '',
    reference: body.reference ?? '',
    notes: body.notes ?? '',
    tags: body.tags ?? [],
    type: body.type ?? (amount >= 0 ? 'income' : 'expense'),
    dedupeKey: dedupeKey(String(accountId), date, amount, description),
    recurringKey: recurringKey(description),
  });

  return ok(tx, 201);
});

export const DELETE = route(async (req: Request) => {
  const userId = await requireUser();
  const { ids, importBatchId } = await req.json();

  if (importBatchId) {
    const res = await Transaction.deleteMany({ userId, importBatchId });
    return ok({ deleted: res.deletedCount ?? 0 });
  }
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Select transactions first.');
  const res = await Transaction.deleteMany({ userId, _id: { $in: ids } });
  return ok({ deleted: res.deletedCount ?? 0 });
});
