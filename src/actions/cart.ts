'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getOrCreateCart, setAppliedPromoCode, readAppliedPromoCode } from '@/lib/cart';
import { validatePromo } from '@/lib/promo';
import { priceCart } from '@/lib/pricing';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import {
  addToCartSchema,
  updateQuantitySchema,
  removeItemSchema,
  promoSchema,
} from '@/schemas/cart';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Flattens the first Zod issue into a single message for the UI. */
function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? 'That request could not be processed.';
}

export async function addToCartAction(formData: FormData): Promise<ActionResult> {
  const parsed = addToCartSchema.safeParse({
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
  });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error.issues) };

  const variant = await db.variant.findUnique({
    where: { id: parsed.data.variantId },
    include: { product: true },
  });
  if (!variant || !variant.product.isActive) {
    return { ok: false, message: 'That item is no longer available.' };
  }
  if (variant.stockQty === 0) {
    return { ok: false, message: 'That item is out of stock.' };
  }

  const cart = await getOrCreateCart();
  const existing = cart.items.find((item) => item.variantId === variant.id);
  const requested = (existing?.quantity ?? 0) + parsed.data.quantity;

  if (requested > variant.stockQty) {
    return {
      ok: false,
      message: `Only ${variant.stockQty} of that item ${variant.stockQty === 1 ? 'is' : 'are'} in stock.`,
    };
  }

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    create: { cartId: cart.id, variantId: variant.id, quantity: parsed.data.quantity },
    update: { quantity: requested },
  });

  revalidatePath('/cart');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Added to your cart.' };
}

export async function updateQuantityAction(formData: FormData): Promise<ActionResult> {
  const parsed = updateQuantitySchema.safeParse({
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
  });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error.issues) };

  const cart = await getOrCreateCart();
  const line = cart.items.find((item) => item.variantId === parsed.data.variantId);
  if (!line) return { ok: false, message: 'That item is not in your cart.' };

  const variant = await db.variant.findUnique({ where: { id: parsed.data.variantId } });
  if (!variant) return { ok: false, message: 'That item is no longer available.' };

  if (parsed.data.quantity > variant.stockQty) {
    return {
      ok: false,
      message: `Only ${variant.stockQty} of that item ${variant.stockQty === 1 ? 'is' : 'are'} in stock.`,
    };
  }

  await db.cartItem.update({
    where: { id: line.id },
    data: { quantity: parsed.data.quantity },
  });

  revalidatePath('/cart');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function removeItemAction(formData: FormData): Promise<ActionResult> {
  const parsed = removeItemSchema.safeParse({ variantId: formData.get('variantId') });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error.issues) };

  const cart = await getOrCreateCart();
  const line = cart.items.find((item) => item.variantId === parsed.data.variantId);
  if (line) await db.cartItem.delete({ where: { id: line.id } });

  revalidatePath('/cart');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function applyPromoAction(formData: FormData): Promise<ActionResult> {
  const ip = await getRequestIp();
  const limit = checkRateLimit(`promo:${ip}`);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  const parsed = promoSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error.issues) };

  const cart = await getOrCreateCart();
  if (cart.items.length === 0) {
    return { ok: false, message: 'Add something to your cart before applying a code.' };
  }

  const { subtotalCents } = priceCart(
    cart.items.map((item) => ({
      unitPriceCents: item.variant.priceCents,
      quantity: item.quantity,
    })),
    null,
  );

  const promo = await db.promoCode.findUnique({ where: { code: parsed.data.code } });
  const result = validatePromo(promo, subtotalCents, new Date());

  if (!result.ok) return { ok: false, message: result.message };

  await setAppliedPromoCode(result.promo.code);
  revalidatePath('/cart');
  return { ok: true, message: `Code ${result.promo.code} applied.` };
}

export async function removePromoAction(): Promise<ActionResult> {
  await setAppliedPromoCode(null);
  revalidatePath('/cart');
  return { ok: true };
}

/** Exposed so checkout can read back what the shopper entered. */
export async function getAppliedPromo(): Promise<string | null> {
  return readAppliedPromoCode();
}
