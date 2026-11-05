import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from '@auth/core/jwt';
import { env, isProduction } from '@/lib/env';

/**
 * Route gating that has to be settled before a response is streamed. Next.js calls
 * this the proxy convention; it runs ahead of the route handlers.
 *
 * Next.js streams dynamic routes, which means the response status is committed
 * before a `notFound()` deeper in the tree can influence it: the not-found UI
 * renders, but the status line has already gone out as 200. Anything that must be
 * an honest 404 or a redirect: admin gating and the signed-in account area: is
 * therefore resolved here, where the status is still ours to set.
 *
 * These checks do not replace the server-side authorisation in the pages and
 * actions themselves, which remain the real boundary. This layer exists so the
 * HTTP semantics are correct.
 */

const SESSION_COOKIE = isProduction ? '__Secure-sokoni.session' : 'sokoni.session';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
    salt: SESSION_COOKIE,
    cookieName: SESSION_COOKIE,
    secureCookie: isProduction,
  });

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // A non-admin is told the route does not exist rather than that it is
    // forbidden: a 403 would confirm the admin surface is there.
    if (token?.role !== 'ADMIN') {
      return NextResponse.rewrite(new URL('/not-found', request.url), { status: 404 });
    }
  }

  if (pathname === '/account' || pathname.startsWith('/account/')) {
    if (!token?.sub) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/account', '/account/:path*'],
};
