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
