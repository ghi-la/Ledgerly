import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ledgerly - personal budgets',
    short_name: 'Ledgerly',
    description: 'Track accounts, categorise imports automatically, and watch your budgets.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F5F2',
    theme_color: '#2E7D6F',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // Lists Ledgerly in Android's share sheet for CSV files (handled by
    // src/app/share-target/route.ts). iOS ignores this; see /api/import/inbox.
    share_target: {
      action: '/share-target',
      method: 'post',
      enctype: 'multipart/form-data',
      params: {
        files: [
          {
            name: 'file',
            accept: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv', '.csv', '.txt'],
          },
        ],
      },
    },
  };
}
