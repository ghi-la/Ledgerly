import { DEFAULT_WIDGETS, User } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const userId = await requireUser();
  const user = (await User.findById(userId).lean()) as any;
  if (!user) throw new HttpError(404, 'Account not found.');
  return ok({
    name: user.name,
    email: user.email,
    settings: {
      currency: user.settings?.currency ?? 'EUR',
      locale: user.settings?.locale ?? 'en-GB',
      startOfMonth: user.settings?.startOfMonth ?? 1,
      dashboard: user.settings?.dashboard?.length ? user.settings.dashboard : DEFAULT_WIDGETS,
    },
  });
});

export const PATCH = route(async (req: Request) => {
  const userId = await requireUser();
  const body = await req.json();
  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = String(body.name).trim();
  if (body.currency !== undefined) set['settings.currency'] = String(body.currency).toUpperCase();
  if (body.locale !== undefined) set['settings.locale'] = String(body.locale);
  if (body.startOfMonth !== undefined) set['settings.startOfMonth'] = Number(body.startOfMonth);
  if (body.dashboard !== undefined) set['settings.dashboard'] = body.dashboard;

  const user = (await User.findByIdAndUpdate(userId, { $set: set }, { new: true }).lean()) as any;
  if (!user) throw new HttpError(404, 'Account not found.');
  return ok({ name: user.name, email: user.email, settings: user.settings });
});
