import Papa from 'papaparse';
import { Account, Category, Transaction } from '@/lib/models';
import { requireUser, route } from '@/lib/api';
import { buildTransactionFilter } from '@/lib/transactionFilter';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const filter = buildTransactionFilter(userId, url.searchParams);

  const [transactions, accounts, categories] = await Promise.all([
    Transaction.find(filter).sort({ date: 1, _id: 1 }).limit(50000).lean(),
    Account.find({ userId }, { name: 1 }).lean(),
    Category.find({ userId }, { name: 1 }).lean(),
  ]);

  const accountName = new Map(accounts.map((a) => [String(a._id), a.name]));
  const categoryName = new Map(categories.map((c) => [String(c._id), c.name]));

  const csv = Papa.unparse({
    fields: [
      'Date',
      'Description',
      'Merchant',
      'Account',
      'Category',
      'Amount',
      'Type',
      'Reference',
      'Notes',
    ],
    data: transactions.map((t) => [
      new Date(t.date).toISOString().slice(0, 10),
      t.description ?? '',
      t.merchant ?? '',
      accountName.get(String(t.accountId)) ?? '',
      t.categoryId ? (categoryName.get(String(t.categoryId)) ?? '') : '',
      t.amount,
      t.type,
      t.reference ?? '',
      t.notes ?? '',
    ]),
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ledgerly-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
