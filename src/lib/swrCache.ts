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
// Only the most recently updated entries are persisted - every page, filter and
// widget range is its own key, and without a cap they'd pile up forever,
// making each flush (synchronous, on the main thread) slower over time.
const MAX_PERSISTED_ENTRIES = 50;

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
    // `map` is kept in least- to most-recently-updated order, so walk it
    // backwards and stop once the newest MAX_PERSISTED_ENTRIES are in.
    const parts: string[] = [];
    for (const key of [...map.keys()].reverse()) {
      if (parts.length >= MAX_PERSISTED_ENTRIES) break;
      // Only persist GET-style SWR entries (plain string keys); skip SWR's
      // internal bookkeeping keys (e.g. "$swr$", "$err$" prefixes) and
      // anything that fails to serialize or is implausibly large.
      if (key.startsWith('$')) continue;
      const serialized = JSON.stringify(map.get(key));
      if (serialized && serialized.length <= MAX_ENTRY_BYTES) {
        parts.push(`${JSON.stringify(key)}:${serialized}`);
      }
    }
    // Back to oldest-first, so the map rebuilt on next load keeps update order.
    parts.reverse();
    window.localStorage.setItem(STORAGE_KEY, `{${parts.join(',')}}`);
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
  let dirty = false;

  if (typeof window !== 'undefined') {
    // Skips the write entirely when nothing changed since the last flush
    // (e.g. a quick app switch back and forth).
    const flush = () => {
      if (!dirty) return;
      dirty = false;
      writeStorage(map);
    };
    // "pagehide"/"visibilitychange" fire reliably when iOS backgrounds a
    // home-screen web app; "beforeunload" is not guaranteed there.
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return {
    keys: () => map.keys(),
    get: (key) => map.get(key) as ReturnType<Cache['get']>,
    set: (key, value) => {
      // Re-inserting moves the key to the end, keeping `map` in update order.
      map.delete(key);
      map.set(key, value);
      dirty = true;
    },
    delete: (key) => {
      map.delete(key);
      dirty = true;
    },
  };
}
