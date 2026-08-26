import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { User } from './models';
import { authConfig } from './auth.config';
import { migrateLegacyDek } from './serverCrypto';

/** Thrown by `authorize` so the client can tell this apart from a wrong password. */
class EmailNotVerifiedSignin extends CredentialsSignin {
  code = 'email-not-verified';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, remember: {} },
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

        // One-time migration off the old password-derived encryption key:
        // this is the only moment the server ever sees the plaintext
        // password, so it's the only place that can unwrap a legacy DEK.
        if (!user.encDekMaster && user.encDekWrapped && user.encSalt && user.encDekIv) {
          try {
            await migrateLegacyDek(user._id, password, user.encSalt, user.encDekWrapped, user.encDekIv);
          } catch (err) {
            console.error('[auth] Legacy DEK migration failed:', err);
          }
        }

        return {
          id: String(user._id),
          email: user.email,
          name: user.name ?? user.email,
          remember: credentials?.remember === 'true',
        };
      },
    }),
  ],
});
