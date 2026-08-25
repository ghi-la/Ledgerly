import { fetcher, send } from './client';
import { encryptField } from './cryptoField';

interface PlainBatchItem {
  _id: string;
  description?: string;
  merchant?: string;
  notes?: string;
}

/**
 * Lazily migrates this user's remaining plaintext transactions to encrypted
 * form, a batch at a time. Safe to call on every login — once nothing is
 * left plaintext, the first batch fetch just comes back empty. Runs silently
 * in the background; failures are non-fatal (the next login retries).
 */
export async function migrateEncryption(dek: CryptoKey) {
  for (;;) {
    const { items } = (await fetcher('/api/transactions/migrate-encryption?limit=200')) as {
      items: PlainBatchItem[];
    };
    if (!items.length) return;

    const encrypted = await Promise.all(
      items.map(async (item) => ({
        id: item._id,
        description: await encryptField(dek, item.description ?? ''),
        merchant: await encryptField(dek, item.merchant ?? ''),
        notes: await encryptField(dek, item.notes ?? ''),
      })),
    );

    await send('/api/transactions/migrate-encryption', 'POST', { items: encrypted });
    if (items.length < 200) return;
  }
}
