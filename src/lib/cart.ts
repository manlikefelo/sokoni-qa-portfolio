import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { isProduction } from './env';
import { getSessionUser } from './auth';
import { priceCart, type AppliedPromo, type PriceBreakdown } from './pricing';

export const GUEST_TOKEN_COOKIE = 'sokoni.guest';
export const PROMO_COOKIE = 'sokoni.promo';

const cartWithItems = {
  items: {
    include: { variant: { include: { product: true } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartWithItems }>;

/** Reads the guest token without creating one. Safe to call during render. */
export async function readGuestToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_TOKEN_COOKIE)?.value ?? null;
}

/**
 * Issues a guest token if none exists. Only callable from a server action or
 * route handler — Next.js forbids setting cookies during a render.
 */
export async function ensureGuestToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_TOKEN_COOKIE)?.value;
  if (existing) return existing;

  const token = randomBytes(24).toString('hex');
  store.set(GUEST_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

/** Resolves the active cart for reading. Returns null when there is nothing yet. */
export async function getCart(): Promise<CartWithItems | null> {
  const user = await getSessionUser();
  if (user) {
    return db.cart.findUnique({ where: { userId: user.id }, include: cartWithItems });
  }
  const token = await readGuestToken();
  if (!token) return null;
  return db.cart.findUnique({ where: { guestToken: token }, include: cartWithItems });
}

/** Resolves the active cart for writing, creating it when absent. */
export async function getOrCreateCart(): Promise<CartWithItems> {
  const user = await getSessionUser();
  if (user) {
    const existing = await db.cart.findUnique({
      where: { userId: user.id },
      include: cartWithItems,
    });
    if (existing) return existing;
    return db.cart.create({ data: { userId: user.id }, include: cartWithItems });
  }

  const token = await ensureGuestToken();
  const existing = await db.cart.findUnique({
    where: { guestToken: token },
    include: cartWithItems,
  });
  if (existing) return existing;
  return db.cart.create({ data: { guestToken: token }, include: cartWithItems });
}

export function cartToLines(cart: CartWithItems | null) {
  if (!cart) return [];
  return cart.items.map((item) => ({
    unitPriceCents: item.variant.priceCents,
    quantity: item.quantity,
  }));
}

export function priceCartEntity(
  cart: CartWithItems | null,
  promo: AppliedPromo | null,
): PriceBreakdown {
  return priceCart(cartToLines(cart), promo);
}

export function cartItemCount(cart: CartWithItems | null): number {
  if (!cart) return 0;
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Moves a guest cart onto the signed-in user so the items survive the login.
 */
export async function mergeGuestCartIntoUserCart(userId: string, guestToken: string) {
  const guestCart = await db.cart.findUnique({
    where: { guestToken },
    include: { items: { include: { variant: true } } },
  });
  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) await db.cart.delete({ where: { id: guestCart.id } });
    return;
  }

  await db.$transaction(async (tx) => {
    const userCart = await tx.cart.findUnique({ where: { userId } });
    if (userCart) {
      await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
      await tx.cart.delete({ where: { id: userCart.id } });
    }

    await tx.cart.update({
      where: { id: guestCart.id },
      data: { userId, guestToken: null },
    });
  });
}

/** Drops the guest cookie once its cart has been folded into a user cart. */
export async function clearGuestToken(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_TOKEN_COOKIE);
}

export async function readAppliedPromoCode(): Promise<string | null> {
  const store = await cookies();
  return store.get(PROMO_COOKIE)?.value ?? null;
}

export async function setAppliedPromoCode(code: string | null): Promise<void> {
  const store = await cookies();
  if (code === null) {
    store.delete(PROMO_COOKIE);
    return;
  }
  store.set(PROMO_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

/**
 * Resolves the promo held in the session cookie against current cart value. A
 * code that was valid when entered but no longer qualifies (the cart shrank below
 * the minimum spend, say) is silently dropped rather than applied.
 */
export async function resolveActivePromo(subtotalCents: number): Promise<AppliedPromo | null> {
  const code = await readAppliedPromoCode();
  if (!code) return null;

  const promo = await db.promoCode.findUnique({ where: { code } });
  const { validatePromo } = await import('./promo');
  const result = validatePromo(promo, subtotalCents, new Date());
  return result.ok ? result.promo : null;
}
