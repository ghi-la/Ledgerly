/**
 * Config for the floating "+" quick-action button on the mobile bottom bar.
 * MUI/React-free (see navConfig.ts for why) so it's cheap to import from the
 * server-side settings validation.
 */

export const FAB_MODES = ['choices', 'transaction', 'import'] as const;
export type FabMode = (typeof FAB_MODES)[number];

export const FAB_ICON_STYLES = ['plain', 'match'] as const;
export type FabIconStyle = (typeof FAB_ICON_STYLES)[number];

export const DEFAULT_FAB_ENABLED = true;
export const DEFAULT_FAB_MODE: FabMode = 'choices';
export const DEFAULT_FAB_ICON_STYLE: FabIconStyle = 'plain';
