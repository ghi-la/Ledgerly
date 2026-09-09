'use client';

/**
 * Persists SWR's cache to localStorage so the last-known data renders
 * immediately on a fresh page load - iOS Safari routinely tears down the
 * web view (and with it SWR's in-memory cache) when the "Add to Home
 * Screen" app is backgrounded for a while, otherwise forcing a blank
 * skeleton screen every reopen while data re-fetches over a mobile
 * connection.
 */

import type { Cache } from 'swr';

const STORAGE_KEY = 'ledgerly-swr-cache';
// Skip persisting any single cache entry above this size, as a cheap guard
// against localStorage's ~5-10MB per-origin quota.
const MAX_ENTRY_BYTES = 200_000;

function readStorage(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStorage(map: Map<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    const entries: Record<string, unknown> = {};
    for (const [key, value] of map) {
      // Only persist GET-style SWR entries (plain string keys); skip SWR's
      // internal bookkeeping keys (e.g. "$swr$", "$err$" prefixes) and
      // anything that fails to serialize or is implausibly large.
      if (key.startsWith('$')) continue;
      const serialized = JSON.stringify(value);
      if (serialized && serialized.length <= MAX_ENTRY_BYTES) {
        entries[key] = value;
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable (e.g. Safari private mode) - the app
    // still works, it just falls back to in-memory-only caching.
  }
}

export function clearPersistedSWRCache() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** SWR cache provider factory - pass as `provider` to `<SWRConfig>`. */
export function localStorageProvider(): Cache {
  const map = new Map<string, unknown>(Object.entries(readStorage()));

  if (typeof window !== 'undefined') {
    const flush = () => writeStorage(map);
    // "pagehide"/"visibilitychange" fire reliably when iOS backgrounds a
    // home-screen web app; "beforeunload" is not guaranteed there.
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return map as Cache;
}
