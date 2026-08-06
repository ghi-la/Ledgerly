import { Category } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const userId = await requireUser();
  const categories = await Category.find({ userId }).sort({ kind: 1, name: 1 }).lean();
  return ok(categories);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();
  if (!body.name?.trim()) throw new HttpError(400, 'Give the category a name.');
  const category = await Category.create({
    userId,
    name: body.name.trim(),
    kind: body.kind === 'income' ? 'income' : 'expense',
    color: body.color ?? '#8C8C8C',
    icon: body.icon ?? 'Label',
    parentId: body.parentId || null,
  });
  return ok(category, 201);
});
