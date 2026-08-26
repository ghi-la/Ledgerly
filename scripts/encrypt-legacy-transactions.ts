/**
 * One-time backfill: encrypts every remaining plaintext (encVersion 0)
 * transaction's description/merchant/notes, now that the server can always
 * decrypt via ENCRYPTION_MASTER_KEY. Replaces the old client-triggered lazy
 * migration, which required the owning user to be logged in. Run once with:
 * npx tsx scripts/encrypt-legacy-transactions.ts
 */
import 'dotenv/config';
import { connectDB } from '../src/lib/db';
import { Transaction, User } from '../src/lib/models';
import { encryptTxFields, getUserDek } from '../src/lib/serverCrypto';
import { recurringKey } from '../src/lib/parse';

const BATCH_SIZE = 500;

async function main() {
  await connectDB();

  const userIds = await Transaction.distinct('userId', { encVersion: { $ne: 1 } });
  console.log(`${userIds.length} account(s) with plaintext transactions to migrate.`);

  let totalEncrypted = 0;

  for (const userId of userIds) {
    if (!(await User.exists({ _id: userId }))) continue;
    const dek = await getUserDek(userId);

    for (;;) {
      const batch = await Transaction.find(
        { userId, encVersion: { $ne: 1 } },
        { description: 1, merchant: 1, notes: 1 },
      )
        .limit(BATCH_SIZE)
        .lean();
      if (!batch.length) break;

      await Promise.all(
        batch.map(async (tx) => {
          const description = String(tx.description ?? '').trim();
          const encrypted = await encryptTxFields(
            { description, merchant: tx.merchant ?? '', notes: tx.notes ?? '' },
            dek,
          );
          await Transaction.updateOne(
            { _id: tx._id },
            {
              $set: {
                description: encrypted.description,
                merchant: encrypted.merchant,
                notes: encrypted.notes,
                encVersion: 1,
                recurringKey: recurringKey(description),
              },
            },
          );
        }),
      );

      totalEncrypted += batch.length;
      console.log(`  user ${userId}: encrypted ${batch.length} (running total ${totalEncrypted})`);
      if (batch.length < BATCH_SIZE) break;
    }
  }

  console.log(`Done. Encrypted ${totalEncrypted} transaction(s) across ${userIds.length} account(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
