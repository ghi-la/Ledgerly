import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// The middleware runs on the Edge runtime, so it uses the database-free config.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    '/((?!api/auth|api/register|api/verify-email|api/resend-verification|login|register|verify-email|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.png|apple-icon.png|icons/).*)',
  ],
};
