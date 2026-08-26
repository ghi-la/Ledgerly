import type { NextAuthConfig } from 'next-auth';
import { encode as defaultEncode } from 'next-auth/jwt';

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const DEFAULT_MAX_AGE = 60 * 15; // 15 minutes of inactivity

/**
 * Edge-safe config with no database imports. The middleware uses this to check
 * the session cookie; the full config in auth.ts adds the Credentials provider
 * (which needs mongoose and therefore the Node runtime).
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt', maxAge: REMEMBER_ME_MAX_AGE },
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [],
  jwt: {
    // Auth.js re-signs the session token on every request, so returning a
    // fresh maxAge here each time turns it into a sliding expiry: 7 days for
    // "remember me" sessions, 15 minutes of inactivity otherwise.
    encode: ({ token, secret, salt }) =>
      defaultEncode({
        token,
        secret,
        salt,
        maxAge: token?.remember === true ? REMEMBER_ME_MAX_AGE : DEFAULT_MAX_AGE,
      }),
  },
  callbacks: {
    authorized({ auth, request }) {
      // The landing page at "/" handles its own auth check and redirect,
      // so it must stay reachable for signed-out visitors.
      if (request.nextUrl.pathname === '/') return true;
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.remember = user.remember === true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) session.user.id = String(token.uid);
      return session;
    },
  },
};
