'use client';

import { useEffect, useRef } from 'react';

/** How recently a shared file must have arrived to be opened automatically. */
const FRESH_MS = 10 * 60_000;
/** Device-level record of files already auto-opened, so each one only redirects once. */
const HANDLED_KEY = 'ledgerly-inbox-handled';
/** Window event carrying a fresh file's id to an import page that's already open. */
export const INBOX_FILE_EVENT = 'ledgerly:inbox-file';

function readHandled(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(HANDLED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function markInboxFileHandled(id: string) {
  try {
    window.localStorage.setItem(HANDLED_KEY, JSON.stringify([id, ...readHandled().filter((h) => h !== id)].slice(0, 20)));
  } catch {
    // Storage unavailable - worst case the same file opens again next launch.
  }
}

/**
 * Calls `onFound` with a file that was just shared into the import inbox (by
 * the iOS Shortcut) when the app launches or comes back to the foreground.
 * iOS can't open a home-screen web app on a given page from a Shortcut, so
 * this is what takes "send, then open Ledgerly" straight to the import.
 */
export function useFreshInboxFile(onFound: (id: string) => void) {
  const callback = useRef(onFound);
  callback.current = onFound;

  useEffect(() => {
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const res = await fetch('/api/import/inbox', { cache: 'no-store' });
        if (!res.ok) return;
        const items: { _id: string; createdAt: string }[] = await res.json();
        const handled = readHandled();
        const fresh = items.find(
          (i) => Date.now() - new Date(i.createdAt).getTime() < FRESH_MS && !handled.includes(i._id),
        );
        if (!fresh) return;
        markInboxFileHandled(fresh._id);
        callback.current(fresh._id);
      } catch {
        // Offline or similar - the file still waits in the inbox list on the import page.
      } finally {
        checking = false;
      }
    };
    void check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
}
