import { Rule } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();

  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = String(body.name).trim();
  if (body.enabled !== undefined) set.enabled = !!body.enabled;
  if (body.priority !== undefined) set.priority = Number(body.priority);
  if (body.matchType !== undefined) set.matchType = body.matchType;
  if (body.conditions !== undefined) set.conditions = body.conditions;
  if (body.stopProcessing !== undefined) set.stopProcessing = !!body.stopProcessing;
  if (body.actions !== undefined) {
    set.actions = {
      categoryId: oid(body.actions.categoryId),
      setType: body.actions.setType || null,
      addTags: body.actions.addTags ?? [],
      setMerchant: body.actions.setMerchant ?? '',
      setNotes: body.actions.setNotes ?? '',
    };
  }

  const rule = await Rule.findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true });
  if (!rule) throw new HttpError(404, 'That rule no longer exists.');
  return ok(rule);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const rule = await Rule.findOneAndDelete({ _id: id, userId });
  if (!rule) throw new HttpError(404, 'That rule no longer exists.');
  return ok({ deleted: true });
});
