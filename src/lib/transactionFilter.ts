import { oid } from '@/lib/api';

/** Builds the Mongo filter shared by the transactions list and CSV export. */
export function buildTransactionFilter(userId: unknown, q: URLSearchParams) {
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

  return filter;
}
