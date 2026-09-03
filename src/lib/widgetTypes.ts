/**
 * Widget types/constants used by both client components (the dashboard) and
 * the server (models.ts's Mongoose schema). Kept mongoose-free and separate
 * from models.ts so importing it from a 'use client' file never pulls the
 * mongoose package into the browser bundle.
 */

export type WidgetType =
  | 'net-worth'
  | 'accounts'
  | 'spend-by-category'
  | 'monthly-trend'
  | 'budget-progress'
  | 'recent-transactions'
  | 'goals'
  | 'income-vs-expense'
  | 'top-merchants';

export const ALL_WIDGET_TYPES: WidgetType[] = [
  'net-worth',
  'accounts',
  'spend-by-category',
  'monthly-trend',
  'budget-progress',
  'recent-transactions',
  'goals',
  'income-vs-expense',
  'top-merchants',
];

export type WidgetSize = 'third' | 'half' | 'two-thirds' | 'full';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title?: string;
  size: WidgetSize;
  visible: boolean;
  config?: Record<string, unknown>;
  layout?: WidgetLayout;
  /** Independent layout for the single-column mobile grid (only x/w are fixed to full-width; y/h are user-editable). */
  mobileLayout?: WidgetLayout;
}

export const DEFAULT_WIDGETS: Widget[] = [
  { id: 'w-networth', type: 'net-worth', size: 'full', visible: true, layout: { x: 0, y: 0, w: 12, h: 5 } },
  { id: 'w-accounts', type: 'accounts', size: 'half', visible: true, layout: { x: 0, y: 5, w: 6, h: 8 } },
  { id: 'w-spend', type: 'spend-by-category', size: 'half', visible: true, layout: { x: 6, y: 5, w: 6, h: 8 } },
  { id: 'w-trend', type: 'monthly-trend', size: 'full', visible: true, layout: { x: 0, y: 13, w: 12, h: 10 } },
  { id: 'w-budget', type: 'budget-progress', size: 'half', visible: true, layout: { x: 0, y: 23, w: 6, h: 8 } },
  { id: 'w-recent', type: 'recent-transactions', size: 'half', visible: true, layout: { x: 6, y: 23, w: 6, h: 8 } },
  { id: 'w-goals', type: 'goals', size: 'half', visible: true, layout: { x: 0, y: 31, w: 6, h: 8 } },
  { id: 'w-inc-exp', type: 'income-vs-expense', size: 'half', visible: false, layout: { x: 6, y: 31, w: 6, h: 8 } },
  { id: 'w-merchants', type: 'top-merchants', size: 'half', visible: false, layout: { x: 0, y: 39, w: 6, h: 8 } },
];
