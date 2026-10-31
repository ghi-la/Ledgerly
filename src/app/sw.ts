/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { ExpirationPlugin, NetworkFirst, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Precaches the build's JS/CSS (the manifest below, injected at build time)
// so a cold reopen on iOS - which tears down the whole web view, wiping
// everything in memory - paints the app shell from cache instead of waiting
// on a fresh network round trip for the bundle. Actual data still comes from
// the network/SWR cache (see providers.tsx); this only speeds up getting the
// app itself on screen.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Overrides defaultCache's /api/ rule (first match wins): its 10s network
    // timeout left a flaky mobile connection staring at skeletons before the
    // cached copy was served, and its 16-entry cap was smaller than one
    // dashboard's worth of per-widget stats keys.
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/'),
      method: 'GET',
      handler: new NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 24 * 60 * 60, maxAgeFrom: 'last-used' })],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
