import { oid } from '@/lib/api';

/**
 * Builds the Mongo filter shared by the transactions list and CSV export.
 * Deliberately excludes text search: description/merchant/notes are
 * encrypted with a random IV per write, so they can never match a Mongo
 * regex. Callers that need text search fetch this filter's results, decrypt
 * them server-side, and filter in application code instead (see
 * `src/app/api/transactions/route.ts`).
 */
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

  return filter;
}
