import { notFound } from 'next/navigation';
import { getSessionUser } from './auth';

/**
 * Admin gating is resolved from the session on the server. A non-admin gets a 404
 * rather than a 403 so the existence of the admin surface is not confirmed to
 * someone who should not see it.
 */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') notFound();
  return user;
}

/** Action-layer variant: returns null instead of throwing a render-time 404. */
export async function getAdminOrNull() {
  const user = await getSessionUser();
  return user && user.role === 'ADMIN' ? user : null;
}
