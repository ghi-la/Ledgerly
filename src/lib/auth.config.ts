import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe config with no database imports. The middleware uses this to check
 * the session cookie; the full config in auth.ts adds the Credentials provider
 * (which needs mongoose and therefore the Node runtime).
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      // The landing page at "/" handles its own auth check and redirect,
      // so it must stay reachable for signed-out visitors.
      if (request.nextUrl.pathname === '/') return true;
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) session.user.id = String(token.uid);
      return session;
    },
  },
};
