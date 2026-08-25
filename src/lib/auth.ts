import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { User } from './models';
import { authConfig } from './auth.config';

/** Thrown by `authorize` so the client can tell this apart from a wrong password. */
class EmailNotVerifiedSignin extends CredentialsSignin {
  code = 'email-not-verified';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '')
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        await connectDB();
        const user = await User.findOne({ email });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        if (!user.emailVerified) throw new EmailNotVerifiedSignin();

        return { id: String(user._id), email: user.email, name: user.name ?? user.email };
      },
    }),
  ],
});
