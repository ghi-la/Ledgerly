import crypto from 'crypto';

export type DateFormat = 'auto' | 'DMY' | 'MDY' | 'YMD';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parses the date shapes banks actually export. Returns null if unreadable. */
export function parseDate(input: string, format: DateFormat = 'auto'): Date | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // 12 Mar 2024 / 12-March-2024
  const named = raw.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,})[\s\-/]+(\d{2,4})$/);
  if (named) {
    const m = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (m) return build(+named[3], m, +named[1]);
  }

  const parts = raw.match(/^(\d{1,4})[./\-](\d{1,2})[./\-](\d{1,4})/);
  if (parts) {
    const [, a, b, c] = parts.map((p) => p) as unknown as string[];
    const n = [Number(a), Number(b), Number(c)];
    if (a.length === 4 || format === 'YMD') return build(n[0], n[1], n[2]);
    if (format === 'MDY') return build(n[2], n[0], n[1]);
    if (format === 'DMY') return build(n[2], n[1], n[0]);
    // auto: a value above 12 in the first slot can only be a day
    if (n[0] > 12) return build(n[2], n[1], n[0]);
    if (n[1] > 12) return build(n[2], n[0], n[1]);
    return build(n[2], n[1], n[0]); // day-first default
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function build(year: number, month: number, day: number): Date | null {
  let y = year;
  if (y < 100) y += y > 70 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(y, month - 1, day, 12, 0, 0));
}

/**
 * Parses amounts across locales: "1,234.56", "1.234,56", "€ 1 234,56", "(45.00)".
 */
export function parseAmount(input: string, decimalSeparator: 'auto' | '.' | ',' = 'auto'): number {
  let s = String(input ?? '').trim();
  if (!s) return NaN;

  const negativeByParens = /^\(.*\)$/.test(s);
  const negativeBySuffix = /(DR|D)$/i.test(s) && !/CR/i.test(s);
  const positiveBySuffix = /(CR|C)$/i.test(s);

  s = s.replace(/[()\s]/g, '').replace(/[A-Za-z€$£¥₹]/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let dec = decimalSeparator;
  if (dec === 'auto') {
    if (lastComma > lastDot) dec = ',';
    else if (lastDot > lastComma) dec = '.';
    else dec = '.';
  }

  s = dec === ',' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');

  let n = parseFloat(s);
  if (isNaN(n)) return NaN;
  if (negativeByParens || negativeBySuffix) n = -Math.abs(n);
  if (positiveBySuffix) n = Math.abs(n);
  return n;
}

/** Stable fingerprint used to skip rows that are already in the account. */
export function dedupeKey(accountId: string, date: Date, amount: number, description: string) {
  const normalized = description.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto
    .createHash('sha1')
    .update(`${accountId}|${date.toISOString().slice(0, 10)}|${amount.toFixed(2)}|${normalized}`)
    .digest('hex');
}

/** Strips dates, card digits and reference noise so repeat payments group together. */
export function normalizeMerchantText(description: string) {
  return description
    .toLowerCase()
    .replace(/\d{2}[./-]\d{2}[./-]\d{2,4}/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same cleanup as normalizeMerchantText, truncated to a short exact-match key. */
export function recurringKey(description: string) {
  return normalizeMerchantText(description).split(' ').slice(0, 4).join(' ');
}
