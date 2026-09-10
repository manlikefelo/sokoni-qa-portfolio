import { cookies } from 'next/headers';
import { z } from 'zod';
import { isProduction } from './env';
import { addressSchema } from '@/schemas/address';

const CHECKOUT_COOKIE = 'sokoni.checkout';

/**
 * The address captured at step one, carried to review and payment. It rides in a
 * signed-scope HttpOnly cookie rather than the URL so a shopper cannot tamper with
 * it between steps, and it is re-validated before the order is written regardless.
 */
export const checkoutStateSchema = z.object({
  email: z.string().email().max(254).optional(),
  addressId: z.string().max(64).optional(),
  address: addressSchema.optional(),
});

export type CheckoutState = z.infer<typeof checkoutStateSchema>;

export async function readCheckoutState(): Promise<CheckoutState | null> {
  const raw = (await cookies()).get(CHECKOUT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = checkoutStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeCheckoutState(state: CheckoutState): Promise<void> {
  const store = await cookies();
  store.set(CHECKOUT_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 60 * 60,
  });
}

export async function clearCheckoutState(): Promise<void> {
  (await cookies()).delete(CHECKOUT_COOKIE);
}
