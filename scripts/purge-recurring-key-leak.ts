/**
 * One-time cleanup: recurringKey used to store a readable snippet of the
 * description even for encrypted (encVersion 1) transactions. Run once with:
 * npx tsx scripts/purge-recurring-key-leak.ts
 */
import { connectDB } from '../src/lib/db';
import { Transaction } from '../src/lib/models';

async function main() {
  await connectDB();
  const res = await Transaction.updateMany(
    { encVersion: 1, recurringKey: { $ne: null } },
    { $set: { recurringKey: null } },
  );
  console.log(`Cleared recurringKey on ${res.modifiedCount} encrypted transaction(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
