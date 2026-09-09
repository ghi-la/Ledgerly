/**
 * The set of pages that can appear in the mobile bottom navigation bar, kept
 * free of any MUI/React import so it's cheap to pull into the server-side
 * settings validation (icons are attached separately, client-side only - see
 * navItems.tsx) - the same split used by widgetTypes.ts for dashboard widgets.
 */

export const BOTTOM_NAV_HREFS = [
  '/dashboard',
  '/transactions',
  '/categories',
  '/rules',
  '/budgets',
  '/goals',
  '/import',
  '/export',
] as const;

export type BottomNavHref = (typeof BOTTOM_NAV_HREFS)[number];

export const DEFAULT_BOTTOM_NAV: BottomNavHref[] = ['/dashboard', '/transactions', '/budgets', '/goals'];

export const BOTTOM_NAV_MIN = 3;
export const BOTTOM_NAV_MAX = 5;
