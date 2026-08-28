import { Account, Transaction } from '@/lib/models';
import { HttpError, invalidateStats, ok, requireUser, route } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();

  const account = await Account.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.institution !== undefined && { institution: body.institution }),
        ...(body.openingBalance !== undefined && { openingBalance: Number(body.openingBalance) }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.archived !== undefined && { archived: !!body.archived }),
      },
    },
    { new: true },
  );
  if (!account) throw new HttpError(404, 'That account no longer exists.');
  invalidateStats(userId);
  return ok(account);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const account = await Account.findOneAndDelete({ _id: id, userId });
  if (!account) throw new HttpError(404, 'That account no longer exists.');
  const { deletedCount } = await Transaction.deleteMany({ userId, accountId: id });
  invalidateStats(userId);
  return ok({ deleted: true, transactionsRemoved: deletedCount ?? 0 });
});
