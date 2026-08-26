import { Category } from '@/lib/models';
import { oid } from '@/lib/api';

/**
 * Builds the Mongo filter shared by the transactions list and CSV export.
 * Deliberately excludes text search: description/merchant/notes are
 * encrypted with a random IV per write, so they can never match a Mongo
 * regex. Callers that need text search fetch this filter's results, decrypt
 * them server-side, and filter in application code instead (see
 * `src/app/api/transactions/route.ts`).
 */
export async function buildTransactionFilter(userId: unknown, q: URLSearchParams) {
  const filter: Record<string, unknown> = { userId };

  const accountId = oid(q.get('accountId'));
  if (accountId) filter.accountId = accountId;

  const categoryParam = q.get('categoryId');
  if (categoryParam === 'none') {
    filter.categoryId = null;
  } else {
    const catOid = oid(categoryParam);
    if (catOid) {
      // A parent category's filter also pulls in its subcategories'
      // transactions, so drilling into a rolled-up category shows everything.
      const children = await Category.find({ userId, parentId: catOid }, { _id: 1 }).lean();
      filter.categoryId = children.length ? { $in: [catOid, ...children.map((c) => c._id)] } : catOid;
    }
  }

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
