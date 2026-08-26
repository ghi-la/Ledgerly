import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    /** Whether "remember me" was checked at sign-in; controls the JWT's lifetime. */
    remember?: boolean;
  }
}
