import { Goal } from '@/lib/models';
import { HttpError, invalidateStats, ok, oid, requireUser, route } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();

  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = String(body.name).trim();
  if (body.targetAmount !== undefined) set.targetAmount = Number(body.targetAmount);
  if (body.savedAmount !== undefined) set.savedAmount = Number(body.savedAmount);
  if (body.targetDate !== undefined) set.targetDate = body.targetDate ? new Date(body.targetDate) : null;
  if (body.accountId !== undefined) set.accountId = oid(body.accountId);
  if (body.color !== undefined) set.color = body.color;
  if (body.archived !== undefined) set.archived = !!body.archived;

  const goal = await Goal.findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true });
  if (!goal) throw new HttpError(404, 'That goal no longer exists.');
  invalidateStats(userId);
  return ok(goal);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  await Goal.deleteOne({ _id: id, userId });
  invalidateStats(userId);
  return ok({ deleted: true });
});
