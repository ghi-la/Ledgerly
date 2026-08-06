import { Rule } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const userId = await requireUser();
  const rules = await Rule.find({ userId }).sort({ priority: 1, createdAt: 1 }).lean();
  return ok(rules);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();
  if (!body.name?.trim()) throw new HttpError(400, 'Give the rule a name.');
  if (!body.conditions?.length) throw new HttpError(400, 'Add at least one condition.');

  const last = (await Rule.findOne({ userId }).sort({ priority: -1 }).lean()) as { priority?: number } | null;

  const rule = await Rule.create({
    userId,
    name: body.name.trim(),
    enabled: body.enabled ?? true,
    priority: body.priority ?? ((last?.priority ?? 0) + 10),
    matchType: body.matchType ?? 'all',
    conditions: body.conditions,
    actions: {
      categoryId: oid(body.actions?.categoryId),
      setType: body.actions?.setType || null,
      addTags: body.actions?.addTags ?? [],
      setMerchant: body.actions?.setMerchant ?? '',
      setNotes: body.actions?.setNotes ?? '',
    },
    stopProcessing: body.stopProcessing ?? true,
  });
  return ok(rule, 201);
});
