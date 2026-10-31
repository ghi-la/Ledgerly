import { InboxFile } from '@/lib/models';
import { ok, requireUser, route } from '@/lib/api';
import { addToInbox, readUpload, userFromBearer } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

/** Files shared into the app and waiting to be reviewed, newest first. */
export const GET = route(async () => {
  const userId = await requireUser();
  return ok(
    await InboxFile.find({ userId }, { content: 0 }).sort({ createdAt: -1 }).lean(),
  );
});

/**
 * Drops a CSV into the inbox. The iOS Shortcut calls this with a personal
 * access token (`Authorization: Bearer ...`), sending the file either as a
 * multipart form field or as the raw request body; a signed-in browser
 * session works too.
 */
export const POST = route(async (req: Request) => {
  const userId = (await userFromBearer(req)) ?? (await requireUser());
  const saved = await addToInbox(userId, await readUpload(req), 'shortcut');
  return ok(saved, 201);
});
