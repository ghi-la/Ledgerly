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
  };
}
