'use client';

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Request failed.');
  }
  return res.json();
};

export async function send(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}

export function formatMoney(value: number, currency = 'EUR', locale = 'en-GB') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export function formatDate(value: string | Date, locale = 'en-GB') {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string, locale = 'en-GB') {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(
    new Date(y, m - 1, 1),
  );
}

/** Time-interval presets every dashboard widget can be set to, independently. */
export const RANGE_PRESETS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '12m', label: '12M' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All' },
] as const;

export type RangeKey = (typeof RANGE_PRESETS)[number]['key'];

export const DEFAULT_RANGE: RangeKey = '3m';

const dateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Turns a preset key into a concrete [from, to] date-string window ending
 * today. "all" sends the sentinel 'oldest'; the server resolves it to the
 * user's actual earliest transaction rather than an arbitrary fixed date.
 */
export function rangeToDates(key: string, today = new Date()): { from: string; to: string } {
  const to = dateStr(today);
  if (key === 'all') return { from: 'oldest', to };
  if (key === 'ytd') return { from: `${today.getFullYear()}-01-01`, to };
  const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[key] ?? 3;
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
  return { from: dateStr(start), to };
}
