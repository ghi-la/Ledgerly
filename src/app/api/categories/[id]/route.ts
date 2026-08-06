import { Category, Rule, Transaction } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();
  const category = await Category.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.kind !== undefined && { kind: body.kind }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.parentId !== undefined && { parentId: body.parentId || null }),
        ...(body.archived !== undefined && { archived: !!body.archived }),
      },
    },
    { new: true },
  );
  if (!category) throw new HttpError(404, 'That category no longer exists.');
  return ok(category);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const category = await Category.findOneAndDelete({ _id: id, userId });
  if (!category) throw new HttpError(404, 'That category no longer exists.');
  // Transactions and rules keep working; they simply lose the category link.
  await Transaction.updateMany({ userId, categoryId: id }, { $set: { categoryId: null } });
  await Rule.updateMany({ userId, 'actions.categoryId': id }, { $set: { 'actions.categoryId': null } });
  return ok({ deleted: true });
});
