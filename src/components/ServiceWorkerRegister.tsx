'use client';

import { useEffect } from 'react';

/** Registers the precaching service worker (src/app/sw.ts) once the app has loaded. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort - the app works fine without it, just without the
      // instant-shell-on-cold-reopen speedup.
    });
  }, []);

  return null;
}
