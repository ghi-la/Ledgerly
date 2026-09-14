/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

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
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
