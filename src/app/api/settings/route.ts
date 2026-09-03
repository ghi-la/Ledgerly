import { ALL_WIDGET_TYPES, DEFAULT_WIDGETS, User } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

const CADENCES = new Set(['weekly', 'fortnightly', 'monthly', 'quarterly', 'twice a year']);
const WIDGET_TYPES = new Set(ALL_WIDGET_TYPES);

function validateDashboard(dashboard: unknown): void {
  if (!Array.isArray(dashboard)) throw new HttpError(400, 'dashboard must be an array.');
  const ids = new Set<string>();
  for (const w of dashboard) {
    if (!w || typeof w.id !== 'string' || !w.id || !WIDGET_TYPES.has(w.type) || ids.has(w.id)) {
      throw new HttpError(400, 'Invalid widget entry.');
    }
    ids.add(w.id);
  }
}

function validateDashboardLayouts(dashboardLayouts: unknown): void {
  if (!Array.isArray(dashboardLayouts)) throw new HttpError(400, 'dashboardLayouts must be an array.');
  const ids = new Set<string>();
  for (const l of dashboardLayouts) {
    if (!l || typeof l.id !== 'string' || !l.id || typeof l.name !== 'string' || !l.name.trim() || ids.has(l.id)) {
      throw new HttpError(400, 'Invalid saved layout entry.');
    }
    ids.add(l.id);
    validateDashboard(l.dashboard);
  }
}

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
      dashboardLayouts: user.settings?.dashboardLayouts ?? [],
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
  if (body.dashboard !== undefined) {
    validateDashboard(body.dashboard);
    set['settings.dashboard'] = body.dashboard;
  }
  if (body.dashboardLayouts !== undefined) {
    validateDashboardLayouts(body.dashboardLayouts);
    set['settings.dashboardLayouts'] = body.dashboardLayouts;
  }
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
