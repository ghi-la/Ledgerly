import { DEFAULT_WIDGETS, User } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

const CADENCES = new Set(['weekly', 'fortnightly', 'monthly', 'quarterly', 'twice a year']);

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
      recurringDateToleranceDays: user.settings?.recurringDateToleranceDays ?? 3,
      recurringAmountTolerance: user.settings?.recurringAmountTolerance ?? 10,
      recurringMinOccurrences: user.settings?.recurringMinOccurrences ?? 3,
      recurringHiddenCadences: user.settings?.recurringHiddenCadences ?? [],
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
  if (body.recurringDateToleranceDays !== undefined) {
    const v = Number(body.recurringDateToleranceDays);
    set['settings.recurringDateToleranceDays'] = Number.isFinite(v) ? Math.max(0, Math.min(14, v)) : 3;
  }
  if (body.recurringAmountTolerance !== undefined) {
    const v = Number(body.recurringAmountTolerance);
    set['settings.recurringAmountTolerance'] = Number.isFinite(v) ? Math.max(0, Math.min(1000, v)) : 10;
  }
  if (body.recurringMinOccurrences !== undefined) {
    const v = Math.round(Number(body.recurringMinOccurrences));
    set['settings.recurringMinOccurrences'] = Number.isFinite(v) ? Math.max(2, Math.min(12, v)) : 3;
  }
  if (body.recurringHiddenCadences !== undefined) {
    set['settings.recurringHiddenCadences'] = Array.isArray(body.recurringHiddenCadences)
      ? body.recurringHiddenCadences.filter((c: unknown) => typeof c === 'string' && CADENCES.has(c))
      : [];
  }

  const user = (await User.findByIdAndUpdate(userId, { $set: set }, { new: true }).lean()) as any;
  if (!user) throw new HttpError(404, 'Account not found.');
  return ok({ name: user.name, email: user.email, settings: user.settings });
});
