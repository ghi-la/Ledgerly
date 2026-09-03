export const GRID_COLS = 12;
export const ROW_HEIGHT = 24;
export const GRID_MARGIN: [number, number] = [16, 16];

// Mobile grid: a single full-width column. Widgets can only be reordered
// (dragged vertically) and resized in height - x/w are always locked to the
// full width, so this never needs to interact with the desktop x/y/w/h grid.
export const GRID_COLS_MOBILE = 4;
export const ROW_HEIGHT_MOBILE = 24;
export const GRID_MARGIN_MOBILE: [number, number] = [0, 16];
const FALLBACK_H_MOBILE = 8;

const SIZE_TO_W: Record<string, number> = { third: 4, half: 6, 'two-thirds': 8, full: 12 };
const FALLBACK_H = 8;

// Quick-pick heights (in grid rows) offered as S/M/L buttons, an alternative
// to freeform drag-resize - the same row unit (ROW_HEIGHT + vertical margin)
// applies on both grids, so these numbers mean the same physical height on
// desktop and mobile.
export const SIZE_PRESET_ROWS = { sm: 6, md: 10, lg: 16 } as const;
export type SizePresetKey = keyof typeof SIZE_PRESET_ROWS;

/**
 * If every widget already has a layout, use it as-is. Otherwise (accounts
 * from before drag/resize existed, or a freshly-added widget type with no
 * saved position) synthesize one coherent packed layout for everybody from
 * their old `size`, so nothing overlaps. This is only ever a render-time
 * fallback - the moment the user drags/resizes anything, the full explicit
 * layout for every widget gets persisted for real.
 */
export function ensureLayouts<
  T extends { size: string; layout?: { x: number; y: number; w: number; h: number } },
>(widgets: T[]): (T & { layout: { x: number; y: number; w: number; h: number } })[] {
  if (widgets.every((w) => w.layout)) {
    return widgets as (T & { layout: { x: number; y: number; w: number; h: number } })[];
  }
  let x = 0;
  let y = 0;
  let rowH = 0;
  return widgets.map((w) => {
    const width = SIZE_TO_W[w.size] ?? 6;
    if (x + width > GRID_COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    const layout = { x, y, w: width, h: FALLBACK_H };
    x += width;
    rowH = Math.max(rowH, FALLBACK_H);
    return { ...w, layout };
  });
}

/** Where a freshly-added widget should land: below everything else, so existing widgets' saved positions are untouched. */
export function nextLayoutSlot(
  widgets: { layout?: { x: number; y: number; w: number; h: number } }[],
  size: string,
): { x: number; y: number; w: number; h: number } {
  const width = SIZE_TO_W[size] ?? 6;
  const maxY = widgets.reduce((m, w) => (w.layout ? Math.max(m, w.layout.y + w.layout.h) : m), 0);
  return { x: 0, y: maxY, w: width, h: FALLBACK_H };
}

/**
 * Mobile equivalent of ensureLayouts(): if every widget already has a
 * mobileLayout, use it as-is. Otherwise synthesize one stacked full-width
 * layout (in current array order) for whichever widgets are missing one, so
 * mobile ordering starts out matching the widget list until the user drags
 * something themselves.
 */
export function ensureMobileLayouts<
  T extends { mobileLayout?: { x: number; y: number; w: number; h: number } },
>(widgets: T[]): (T & { mobileLayout: { x: number; y: number; w: number; h: number } })[] {
  if (widgets.every((w) => w.mobileLayout)) {
    return widgets as (T & { mobileLayout: { x: number; y: number; w: number; h: number } })[];
  }
  let y = 0;
  return widgets.map((w) => {
    const mobileLayout = w.mobileLayout ?? { x: 0, y, w: GRID_COLS_MOBILE, h: FALLBACK_H_MOBILE };
    y = mobileLayout.y + mobileLayout.h;
    return { ...w, mobileLayout };
  });
}

/** Where a freshly-added widget should land on the mobile grid: below everything else. */
export function nextMobileLayoutSlot(
  widgets: { mobileLayout?: { x: number; y: number; w: number; h: number } }[],
): { x: number; y: number; w: number; h: number } {
  const maxY = widgets.reduce(
    (m, w) => (w.mobileLayout ? Math.max(m, w.mobileLayout.y + w.mobileLayout.h) : m),
    0,
  );
  return { x: 0, y: maxY, w: GRID_COLS_MOBILE, h: FALLBACK_H_MOBILE };
}

/**
 * Rebuilds the mobile (single-column) layout from the desktop one: widgets
 * are stacked full-width in desktop reading order (top-to-bottom,
 * left-to-right), each keeping its desktop height - both grids share the
 * same row unit, so heights carry over unchanged.
 */
export function mobileFromDesktop<
  T extends { id: string; layout?: { x: number; y: number; w: number; h: number } },
>(widgets: T[]): (T & { mobileLayout: { x: number; y: number; w: number; h: number } })[] {
  const order = [...widgets].sort((a, b) => {
    const ay = a.layout?.y ?? 0;
    const by = b.layout?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a.layout?.x ?? 0) - (b.layout?.x ?? 0);
  });
  const mobileById = new Map<string, { x: number; y: number; w: number; h: number }>();
  let y = 0;
  for (const w of order) {
    const h = w.layout?.h ?? FALLBACK_H_MOBILE;
    mobileById.set(w.id, { x: 0, y, w: GRID_COLS_MOBILE, h });
    y += h;
  }
  return widgets.map((w) => ({ ...w, mobileLayout: mobileById.get(w.id)! }));
}

/**
 * Rebuilds the desktop layout from the mobile one: widgets are packed two
 * per row (half-width) in mobile reading order, each keeping its mobile
 * height.
 */
export function desktopFromMobile<
  T extends { id: string; mobileLayout?: { x: number; y: number; w: number; h: number } },
>(widgets: T[]): (T & { layout: { x: number; y: number; w: number; h: number } })[] {
  const order = [...widgets].sort((a, b) => (a.mobileLayout?.y ?? 0) - (b.mobileLayout?.y ?? 0));
  const width = GRID_COLS / 2;
  const desktopById = new Map<string, { x: number; y: number; w: number; h: number }>();
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const w of order) {
    const h = w.mobileLayout?.h ?? FALLBACK_H;
    if (x + width > GRID_COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    desktopById.set(w.id, { x, y, w: width, h });
    x += width;
    rowH = Math.max(rowH, h);
  }
  return widgets.map((w) => ({ ...w, layout: desktopById.get(w.id)! }));
}
