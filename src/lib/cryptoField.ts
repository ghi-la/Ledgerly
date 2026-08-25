'use client';

/**
 * Client-side field encryption for sensitive transaction text (description,
 * merchant, notes). The server never sees plaintext for these fields or holds
 * any key capable of decrypting them — only the browser, after the user's
 * password has derived the key-encryption key (KEK) that unwraps their
 * random per-account data-encryption key (DEK).
 *
 * Envelope encryption (password -> KEK -> unwraps DEK -> encrypts fields)
 * means a future password change only has to re-wrap the DEK, not
 * re-encrypt every field in the database.
 */

const PBKDF2_ITERATIONS = 600_000;

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export function generateSaltB64(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

async function deriveKek(password: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Wraps (encrypts) a DEK with a password-derived KEK, for storage on the user record. */
export async function wrapDek(
  dek: CryptoKey,
  password: string,
  saltB64: string,
): Promise<{ wrapped: string; iv: string }> {
  const kek = await deriveKek(password, saltB64);
  const raw = await crypto.subtle.exportKey('raw', dek);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return { wrapped: toB64(ciphertext), iv: toB64(iv) };
}

/** Unwraps a stored DEK using the password entered at login. */
export async function unwrapDek(
  wrappedB64: string,
  ivB64: string,
  password: string,
  saltB64: string,
): Promise<CryptoKey> {
  const kek = await deriveKek(password, saltB64);
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, kek, fromB64(wrappedB64));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

export async function exportDekRawB64(dek: CryptoKey): Promise<string> {
  return toB64(await crypto.subtle.exportKey('raw', dek));
}

export async function importDekRawB64(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64(b64), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

/** Encrypts one field's plaintext into a storable `"<iv>.<ciphertext>"` blob (both base64). */
export async function encryptField(dek: CryptoKey, plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    new TextEncoder().encode(plaintext),
  );
  return `${toB64(iv)}.${toB64(ciphertext)}`;
}

/**
 * Decrypts one field's stored blob. Callers must only call this when the
 * record's `encVersion` says the field really is ciphertext — this function
 * does not sniff the format, since plaintext can coincidentally contain a dot.
 */
export async function decryptField(dek: CryptoKey, blob: string): Promise<string> {
  if (!blob) return '';
  const dot = blob.indexOf('.');
  if (dot < 0) return '[unable to decrypt]';
  try {
    const iv = fromB64(blob.slice(0, dot));
    const ciphertext = fromB64(blob.slice(dot + 1));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    return '[unable to decrypt]';
  }
}

export interface EncryptableTx {
  description?: string | null;
  merchant?: string | null;
  notes?: string | null;
  encVersion?: number;
}

/** Decrypts description/merchant/notes on a transaction-shaped object, leaving legacy plaintext (encVersion !== 1) untouched. */
export async function decryptTxFields<T extends EncryptableTx>(tx: T, dek: CryptoKey | null): Promise<T> {
  if (tx.encVersion !== 1 || !dek) return tx;
  const [description, merchant, notes] = await Promise.all([
    decryptField(dek, tx.description ?? ''),
    decryptField(dek, tx.merchant ?? ''),
    decryptField(dek, tx.notes ?? ''),
  ]);
  return { ...tx, description, merchant, notes };
}

/** Encrypts description/merchant/notes on a transaction-shaped object ahead of a write. */
export async function encryptTxFields<T extends EncryptableTx>(
  tx: T,
  dek: CryptoKey,
): Promise<T & { encVersion: 1 }> {
  const [description, merchant, notes] = await Promise.all([
    encryptField(dek, tx.description ?? ''),
    encryptField(dek, tx.merchant ?? ''),
    encryptField(dek, tx.notes ?? ''),
  ]);
  return { ...tx, description, merchant, notes, encVersion: 1 };
}
