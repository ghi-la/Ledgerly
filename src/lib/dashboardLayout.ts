export const GRID_COLS = 12;
export const ROW_HEIGHT = 24;
export const GRID_MARGIN: [number, number] = [16, 16];

const SIZE_TO_W: Record<string, number> = { third: 4, half: 6, 'two-thirds': 8, full: 12 };
const FALLBACK_H = 8;

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
