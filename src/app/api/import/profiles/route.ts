import { ImportProfile } from '@/lib/models';
import { HttpError, ok, oid, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Saved column mappings so the same bank export imports in one click next time. */
export const GET = route(async () => {
  const userId = await requireUser();
  return ok(await ImportProfile.find({ userId }).sort({ name: 1 }).lean());
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();
  if (!body.name?.trim()) throw new HttpError(400, 'Give the layout a name.');
  const profile = await ImportProfile.findOneAndUpdate(
    { userId, name: body.name.trim() },
    {
      $set: {
        accountId: oid(body.accountId),
        delimiter: body.delimiter ?? '',
        dateFormat: body.dateFormat ?? 'auto',
        amountMode: body.amountMode ?? 'single',
        invertSign: !!body.invertSign,
        decimalSeparator: body.decimalSeparator ?? 'auto',
        mapping: body.mapping ?? {},
      },
    },
    { upsert: true, new: true },
  );
  return ok(profile, 201);
});

export const DELETE = route(async (req: Request) => {
  const userId = await requireUser();
  const { id } = await req.json();
  await ImportProfile.deleteOne({ _id: id, userId });
  return ok({ deleted: true });
});
