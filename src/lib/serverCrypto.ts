import { webcrypto } from 'node:crypto';
import { User } from './models';

/**
 * Server-held envelope encryption for transaction description/merchant/notes.
 * ENCRYPTION_MASTER_KEY wraps each user's per-account data-encryption key
 * (DEK), so the server can always decrypt for search, rules, and display -
 * unlike the password-derived scheme this replaces, decryption no longer
 * depends on anything living in the browser.
 */

const PBKDF2_ITERATIONS = 600_000;

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(bytes as ArrayBuffer).toString('base64');
}

function fromB64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

let masterKeyPromise: Promise<webcrypto.CryptoKey> | null = null;

function getMasterKey(): Promise<webcrypto.CryptoKey> {
  if (!masterKeyPromise) {
    const raw = process.env.ENCRYPTION_MASTER_KEY;
    if (!raw) throw new Error('ENCRYPTION_MASTER_KEY is not set.');
    const bytes = fromB64(raw);
    if (bytes.length !== 32) {
      throw new Error('ENCRYPTION_MASTER_KEY must be 32 random bytes, base64-encoded.');
    }
    masterKeyPromise = webcrypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  return masterKeyPromise;
}

export async function generateDek(): Promise<webcrypto.CryptoKey> {
  return webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Generates a fresh DEK for a brand-new account, wrapped for storage on the User doc. */
export async function generateDekWrappedForNewUser(): Promise<{ encDekMaster: string; encDekMasterIv: string }> {
  const dek = await generateDek();
  const { wrapped, iv } = await wrapDekWithMaster(dek);
  return { encDekMaster: wrapped, encDekMasterIv: iv };
}

async function wrapDekWithMaster(dek: webcrypto.CryptoKey): Promise<{ wrapped: string; iv: string }> {
  const master = await getMasterKey();
  const raw = await webcrypto.subtle.exportKey('raw', dek);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, raw);
  return { wrapped: toB64(ciphertext), iv: toB64(iv) };
}

async function unwrapDekWithMaster(wrappedB64: string, ivB64: string): Promise<webcrypto.CryptoKey> {
  const master = await getMasterKey();
  const raw = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, master, fromB64(wrappedB64));
  return webcrypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

/**
 * Loads (or lazily creates) the signed-in user's DEK, unwrapped with the
 * server master key. Only ever generates a fresh DEK when there's no key
 * material of any kind on the account - if a legacy password-wrapped DEK is
 * present but hasn't been migrated yet (see `migrateLegacyDek`), this throws
 * rather than silently minting an unrelated key that would orphan every
 * transaction already encrypted under the real one.
 */
export async function getUserDek(userId: unknown): Promise<webcrypto.CryptoKey> {
  const user = (await User.findById(userId, {
    encDekMaster: 1,
    encDekMasterIv: 1,
    encDekWrapped: 1,
  }).lean()) as {
    encDekMaster?: string | null;
    encDekMasterIv?: string | null;
    encDekWrapped?: string | null;
  } | null;
  if (!user) throw new Error('User not found.');

  if (user.encDekMaster && user.encDekMasterIv) {
    return unwrapDekWithMaster(user.encDekMaster, user.encDekMasterIv);
  }
  if (user.encDekWrapped) {
    throw new Error('Encryption key not yet migrated for this account; please sign in again.');
  }

  const dek = await generateDek();
  const { wrapped, iv } = await wrapDekWithMaster(dek);
  await User.updateOne({ _id: userId }, { $set: { encDekMaster: wrapped, encDekMasterIv: iv } });
  return dek;
}

/**
 * One-time migration for accounts created under the old password-derived
 * scheme: unwraps their real DEK with the plaintext password (only available
 * here, briefly, right after NextAuth verifies it) and re-wraps it with the
 * server master key. Safe to call on every login - once `encDekMaster` is
 * set it's a no-op for the caller to skip.
 */
export async function migrateLegacyDek(
  userId: unknown,
  password: string,
  encSalt: string,
  encDekWrapped: string,
  encDekIv: string,
): Promise<void> {
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const kek = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(encSalt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const raw = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(encDekIv) }, kek, fromB64(encDekWrapped));
  const dek = await webcrypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);

  const { wrapped, iv } = await wrapDekWithMaster(dek);
  await User.updateOne({ _id: userId }, { $set: { encDekMaster: wrapped, encDekMasterIv: iv } });
}

/** Encrypts one field's plaintext into a storable `"<iv>.<ciphertext>"` blob (both base64). */
export async function encryptField(dek: webcrypto.CryptoKey, plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    new TextEncoder().encode(plaintext),
  );
  return `${toB64(iv)}.${toB64(ciphertext)}`;
}

/**
 * Decrypts one field's stored blob. Callers must only call this when the
 * record's `encVersion` says the field really is ciphertext.
 */
export async function decryptField(dek: webcrypto.CryptoKey, blob: string): Promise<string> {
  if (!blob) return '';
  const dot = blob.indexOf('.');
  if (dot < 0) return '[unable to decrypt]';
  try {
    const iv = fromB64(blob.slice(0, dot));
    const ciphertext = fromB64(blob.slice(dot + 1));
    const plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    return '[unable to decrypt]';
  }
}

/**
 * Decrypts description/merchant/notes on a transaction-shaped object, leaving
 * legacy plaintext (encVersion !== 1) untouched. Takes/returns
 * `Record<string, unknown>` rather than a typed interface because callers
 * pass Mongoose `.lean()` documents, whose inferred type is too loose for
 * TypeScript to structurally match a named interface.
 */
export async function decryptTxFields(
  tx: Record<string, unknown>,
  dek: webcrypto.CryptoKey,
): Promise<Record<string, unknown>> {
  if (tx.encVersion !== 1) return tx;
  const [description, merchant, notes] = await Promise.all([
    decryptField(dek, (tx.description as string) ?? ''),
    decryptField(dek, (tx.merchant as string) ?? ''),
    decryptField(dek, (tx.notes as string) ?? ''),
  ]);
  return { ...tx, description, merchant, notes };
}

/** Encrypts description/merchant/notes on a transaction-shaped object ahead of a write. */
export async function encryptTxFields(
  tx: Record<string, unknown>,
  dek: webcrypto.CryptoKey,
): Promise<Record<string, unknown> & { encVersion: 1 }> {
  const [description, merchant, notes] = await Promise.all([
    encryptField(dek, (tx.description as string) ?? ''),
    encryptField(dek, (tx.merchant as string) ?? ''),
    encryptField(dek, (tx.notes as string) ?? ''),
  ]);
  return { ...tx, description, merchant, notes, encVersion: 1 };
}
