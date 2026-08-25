/**
 * Optional demo seed. Run once with: npm run seed
 * Creates a demo@ledgerly.app / password12345 login with example data.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/lib/db';
import { Account, Category, Rule, Transaction, User } from '../src/lib/models';
import { STARTER_CATEGORIES, STARTER_RULES, CATEGORY_PALETTE } from '../src/lib/starter';
import { dedupeKey, recurringKey } from '../src/lib/parse';

async function main() {
  await connectDB();
  const email = 'demo@ledgerly.app';
  await User.deleteOne({ email });

  const user = await User.create({
    name: 'Demo',
    email,
    passwordHash: await bcrypt.hash('password12345', 10),
    emailVerified: true,
  });

  const account = await Account.create({ userId: user._id, name: 'Everyday', type: 'checking' });
  const savings = await Account.create({ userId: user._id, name: 'Savings', type: 'savings', openingBalance: 3200 });

  const cats = await Category.insertMany(
    STARTER_CATEGORIES.map((c, i) => ({
      userId: user._id,
      name: c.name,
      kind: c.kind,
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
    })),
  );
  const byName = new Map(cats.map((c) => [c.name, c._id]));

  await Rule.insertMany(
    STARTER_RULES.filter((r) => byName.has(r.category)).map((r, i) => ({
      userId: user._id,
      name: r.name,
      priority: (i + 1) * 10,
      matchType: 'any',
      conditions: r.keywords.map((k) => ({ field: 'description', operator: 'contains', value: k })),
      actions: { categoryId: byName.get(r.category) },
    })),
  );

  const samples = [
    ['SALARY ACME PAYROLL', 2450, 'Salary'],
    ['TESCO STORES 3412', -54.19, 'Groceries'],
    ['NETFLIX.COM', -12.99, 'Subscriptions'],
    ['SHELL FUEL', -61.3, 'Transport'],
    ['OCTOPUS ENERGY DD', -96, 'Utilities'],
    ['DELIVEROO', -27.4, 'Eating out'],
  ] as const;

  const now = new Date();
  const docs = [];
  let i = 0;
  for (let m = 0; m < 4; m++) {
    for (const [desc, amt, cat] of samples) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, 5 + (i % 20));
      i++;
      docs.push({
        userId: user._id,
        accountId: account._id,
        categoryId: byName.get(cat),
        date,
        amount: amt,
        description: desc,
        type: amt >= 0 ? 'income' : 'expense',
        dedupeKey: dedupeKey(String(account._id), date, amt, desc),
        recurringKey: recurringKey(desc),
      });
    }
  }
  await Transaction.insertMany(docs);

  console.log(`Seeded ${email} / password12345 with ${docs.length} transactions.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
