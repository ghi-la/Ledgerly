import { InboxFile } from '@/lib/models';
import { ok, oid, requireUser, route } from '@/lib/api';
import { readInboxFile } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** The shared file's decrypted CSV text, for the import page to parse. */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  return ok(await readInboxFile(userId, id));
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  await InboxFile.deleteOne({ _id: oid(id), userId });
  return ok({ deleted: true });
});
