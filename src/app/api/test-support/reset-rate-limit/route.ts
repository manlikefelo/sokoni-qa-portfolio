import { NextResponse } from 'next/server';
import { clearAllRateLimits } from '@/lib/rate-limit';
import { env } from '@/lib/env';

/**
 * Clears the in-memory rate-limit buckets. Exists so the test suite can exercise
 * login, registration and promo application more than ten times in a fifteen-minute
 * window without weakening the limiter itself: that limiter is a PRD 7 requirement
 * and has its own tests.
 *
 * Gated on TEST_SUPPORT_TOKEN being set and matching. The environment variable is the
 * control, not NODE_ENV: the suite runs against a production build on purpose, because
 * several assertions are about HTTP status codes and Next.js streams differently in
 * development. A deployment that never sets the variable has no route here: the
 * handler answers 404, so its existence is not advertised either.
 *
 * Returning 404 rather than 401 is deliberate for the same reason the admin routes do:
 * an unauthenticated caller learns nothing about what exists.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = env.TEST_SUPPORT_TOKEN;
  if (expected === undefined) {
    return new NextResponse('Not found', { status: 404 });
  }

  const provided = request.headers.get('x-test-support-token');
  if (provided !== expected) {
    return new NextResponse('Not found', { status: 404 });
  }

  clearAllRateLimits();
  return NextResponse.json({ ok: true });
}
