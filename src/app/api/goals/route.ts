import { Goal } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const userId = await requireUser();
  return ok(await Goal.find({ userId }).sort({ archived: 1, targetDate: 1 }).lean());
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();
  if (!body.name?.trim()) throw new HttpError(400, 'Give the goal a name.');
  const targetAmount = Number(body.targetAmount);
  if (!(targetAmount > 0)) throw new HttpError(400, 'Set a target above zero.');

  const goal = await Goal.create({
    userId,
    name: body.name.trim(),
    targetAmount,
    savedAmount: Number(body.savedAmount ?? 0),
    targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
    accountId: oid(body.accountId),
    color: body.color ?? '#E0A458',
  });
  return ok(goal, 201);
});
