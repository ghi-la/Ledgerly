import withSerwistInit from '@serwist/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongoose', 'bcryptjs'],
};

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Avoids stale cached chunks fighting fast refresh while developing.
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
