import crypto from 'crypto';
import mongoose from 'mongoose';
import { ApiToken, InboxFile } from './models';
import { HttpError, oid } from './api';
import { connectDB } from './db';
import { decryptField, encryptField, getUserDek } from './serverCrypto';

/**
 * The import inbox: CSVs shared into Ledgerly from outside the app (an iOS
 * Shortcut posting with a personal access token, or Android's share sheet via
 * the manifest's share_target) wait here until reviewed on the import page.
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_INBOX_FILES = 20;
const TOKEN_PREFIX = 'ldg_';

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function generateToken() {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token), prefix: token.slice(0, TOKEN_PREFIX.length + 6) };
}

/** Resolves an `Authorization: Bearer <token>` header to its user, or null when there's none. */
export async function userFromBearer(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  await connectDB();
  const token = await ApiToken.findOneAndUpdate(
    { tokenHash: hashToken(match[1]) },
    { $set: { lastUsedAt: new Date() } },
  ).lean<{ userId: mongoose.Types.ObjectId }>();
  if (!token) throw new HttpError(401, 'That access token is not valid. Create a new one in Settings.');
  return token.userId;
}

/** Bank exports aren't always UTF-8; older Italian/European ones are often Windows-1252. */
function decodeText(bytes: Uint8Array) {
  if (bytes.includes(0)) throw new HttpError(415, 'That file is not a CSV.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Pulls the shared file out of a multipart form (any file field) or a raw request body. */
export async function readUpload(req: Request): Promise<{ fileName: string; text: string }> {
  const contentType = req.headers.get('content-type') ?? '';
  let fileName = new URL(req.url).searchParams.get('name') || req.headers.get('x-filename') || '';
  let bytes: Uint8Array;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = [...form.values()].find((v): v is File => typeof v !== 'string');
    if (!file) throw new HttpError(400, 'No file was attached.');
    if (file.size > MAX_FILE_BYTES) throw new HttpError(413, 'That file is too large (2 MB max).');
    fileName ||= file.name;
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) throw new HttpError(413, 'That file is too large (2 MB max).');
  }

  const text = decodeText(bytes);
  if (!text.trim()) throw new HttpError(400, 'No file was attached.');
  // A raw-body upload (the Shortcut's "File" request body) carries no file name.
  const fallbackName = `import-${new Date().toISOString().slice(0, 10)}.csv`;
  return { fileName: fileName.trim() || fallbackName, text };
}

export async function addToInbox(
  userId: mongoose.Types.ObjectId,
  upload: { fileName: string; text: string },
  source: 'shortcut' | 'share-target',
) {
  if ((await InboxFile.countDocuments({ userId })) >= MAX_INBOX_FILES) {
    throw new HttpError(429, 'Your import inbox is full. Import or discard some files first.');
  }
  const content = await encryptField(await getUserDek(userId), upload.text);
  const doc = await InboxFile.create({
    userId,
    fileName: upload.fileName.slice(0, 200),
    size: Buffer.byteLength(upload.text),
    source,
    content,
  });
  return { _id: String(doc._id), fileName: doc.fileName as string };
}

export async function readInboxFile(userId: mongoose.Types.ObjectId, id: string) {
  const doc = await InboxFile.findOne({ _id: oid(id), userId }).lean<{
    _id: mongoose.Types.ObjectId;
    fileName: string;
    content: string;
    createdAt: Date;
  }>();
  if (!doc) throw new HttpError(404, 'That file is no longer waiting to be imported.');
  const text = await decryptField(await getUserDek(userId), doc.content);
  return { _id: String(doc._id), fileName: doc.fileName, createdAt: doc.createdAt, text };
}
