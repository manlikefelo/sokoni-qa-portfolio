import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from './db';
import { env, isProduction } from './env';
import { verifyPassword } from './password';
import { loginSchema } from '@/schemas/auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: 'CUSTOMER' | 'ADMIN' } & DefaultSession['user'];
  }
  interface User {
    role: 'CUSTOMER' | 'ADMIN';
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  trustHost: true,
  pages: { signIn: '/login' },
  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-sokoni.session' : 'sokoni.session',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user) {
          // Hash a throwaway value so a missing account costs the same wall-clock
          // time as a wrong password. Response timing must not leak which emails
          // are registered.
          await verifyPassword(
            '$argon2id$v=19$m=19456,t=2,p=1$c29rb25pdGltaW5n$0000000000000000000000000000000000000000000',
            parsed.data.password,
          );
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
      return session;
    },
  },
});

/** Session accessor for server components and actions. Never trusts client input. */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role, email: session.user.email ?? '' };
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
