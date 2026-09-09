import { ALL_WIDGET_TYPES, DEFAULT_WIDGETS, User } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';
import { BOTTOM_NAV_HREFS, BOTTOM_NAV_MAX, BOTTOM_NAV_MIN, DEFAULT_BOTTOM_NAV } from '@/lib/navConfig';
import {
  DEFAULT_FAB_ENABLED,
  DEFAULT_FAB_ICON_STYLE,
  DEFAULT_FAB_MODE,
  FAB_ICON_STYLES,
  FAB_MODES,
} from '@/lib/fabConfig';

export const dynamic = 'force-dynamic';

const CADENCES = new Set(['weekly', 'fortnightly', 'monthly', 'quarterly', 'twice a year']);
const WIDGET_TYPES = new Set(ALL_WIDGET_TYPES);
const BOTTOM_NAV_SET = new Set<string>(BOTTOM_NAV_HREFS);
const FAB_MODE_SET = new Set<string>(FAB_MODES);
const FAB_ICON_STYLE_SET = new Set<string>(FAB_ICON_STYLES);

function validateBottomNav(bottomNav: unknown): void {
  if (!Array.isArray(bottomNav)) throw new HttpError(400, 'bottomNav must be an array.');
  if (bottomNav.length < BOTTOM_NAV_MIN || bottomNav.length > BOTTOM_NAV_MAX) {
    throw new HttpError(400, `bottomNav must have between ${BOTTOM_NAV_MIN} and ${BOTTOM_NAV_MAX} links.`);
  }
  const seen = new Set<string>();
  for (const href of bottomNav) {
    if (typeof href !== 'string' || !BOTTOM_NAV_SET.has(href) || seen.has(href)) {
      throw new HttpError(400, 'Invalid bottom navigation entry.');
    }
    seen.add(href);
  }
}

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
      bottomNav: user.settings?.bottomNav?.length ? user.settings.bottomNav : DEFAULT_BOTTOM_NAV,
      fabEnabled: user.settings?.fabEnabled ?? DEFAULT_FAB_ENABLED,
      fabMode: user.settings?.fabMode ?? DEFAULT_FAB_MODE,
      fabIconStyle: user.settings?.fabIconStyle ?? DEFAULT_FAB_ICON_STYLE,
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
  if (body.bottomNav !== undefined) {
    validateBottomNav(body.bottomNav);
    set['settings.bottomNav'] = body.bottomNav;
  }
  if (body.fabEnabled !== undefined) set['settings.fabEnabled'] = Boolean(body.fabEnabled);
  if (body.fabMode !== undefined) {
    if (typeof body.fabMode !== 'string' || !FAB_MODE_SET.has(body.fabMode)) {
      throw new HttpError(400, 'Invalid fabMode.');
    }
    set['settings.fabMode'] = body.fabMode;
  }
  if (body.fabIconStyle !== undefined) {
    if (typeof body.fabIconStyle !== 'string' || !FAB_ICON_STYLE_SET.has(body.fabIconStyle)) {
      throw new HttpError(400, 'Invalid fabIconStyle.');
    }
    set['settings.fabIconStyle'] = body.fabIconStyle;
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
