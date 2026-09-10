import { headers } from 'next/headers';

/**
 * Resolves the caller's address for rate-limiting purposes. Behind a proxy the
 * left-most x-forwarded-for entry is the client; the value is untrusted input so
 * it is only ever used as a bucket key, never for authorisation.
 */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip') ?? '127.0.0.1';
}
