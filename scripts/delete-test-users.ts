/**
 * Deletes test/junk accounts and all of their data.
 * Run with: npx tsx scripts/delete-test-users.ts
 */
import 'dotenv/config';
import { connectDB } from '../src/lib/db';
import {
  Account,
  Budget,
  Category,
  Goal,
  ImportProfile,
  Rule,
  Transaction,
  User,
} from '../src/lib/models';

const TEST_EMAILS = [
  'recur-check-1787665034492@example.com',
  'recur-check-1787665072524@example.com',
  'recur-check-1787665091888@example.com',
  'asd@asd.asd',
  'bigdong@grandecazzonero.it',
  'xewivam761@archifun.com',
  'demo@ledgerly.app',
  'asd@soulsbros.ch',
];

async function main() {
  await connectDB();

  for (const email of TEST_EMAILS) {
    const user = (await User.findOne({ email }).lean()) as { _id: unknown } | null;
    if (!user) {
      console.log(`- ${email}: no such user, skipping.`);
      continue;
    }

    const userId = user._id;
    const [accounts, categories, transactions, rules, budgets, goals, importProfiles] = await Promise.all([
      Account.deleteMany({ userId }),
      Category.deleteMany({ userId }),
      Transaction.deleteMany({ userId }),
      Rule.deleteMany({ userId }),
      Budget.deleteMany({ userId }),
      Goal.deleteMany({ userId }),
      ImportProfile.deleteMany({ userId }),
    ]);
    await User.deleteOne({ _id: userId });

    console.log(
      `- ${email}: deleted ${transactions.deletedCount} transactions, ${accounts.deletedCount} accounts, ` +
        `${categories.deletedCount} categories, ${rules.deletedCount} rules, ${budgets.deletedCount} budgets, ` +
        `${goals.deletedCount} goals, ${importProfiles.deletedCount} import profiles, and the user.`,
    );
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
