import { NextResponse } from 'next/server';
import { HttpError, requireUser } from '@/lib/api';
import { addToInbox, readUpload } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

/**
 * Web Share Target (see manifest.ts): on Android, sharing a CSV to the
 * installed app POSTs it here as multipart form data. The file goes into the
 * import inbox and the import page opens straight on it. iOS doesn't support
 * share targets, so iPhones go through the Shortcut + /api/import/inbox instead.
 */
export async function POST(req: Request) {
  const redirect = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  try {
    const userId = await requireUser();
    const saved = await addToInbox(userId, await readUpload(req), 'share-target');
    return redirect(`/import?inbox=${saved._id}`);
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    return redirect(`/import?shareError=${encodeURIComponent(message)}`);
  }
}
