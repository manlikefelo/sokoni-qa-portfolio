'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getCart, setAppliedPromoCode, resolveActivePromo, cartToLines } from '@/lib/cart';
import { computeSubtotal, priceCart } from '@/lib/pricing';
import { formatOrderNumber } from '@/lib/order-number';
import { readCheckoutState, writeCheckoutState, clearCheckoutState } from '@/lib/checkout-session';
import { addressSchema, guestCheckoutSchema } from '@/schemas/address';
import { mockPaymentSchema } from '@/schemas/payment';
import type { PaymentResponse } from '@/app/api/mock-payment/route';

export interface CheckoutResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  orderNumber?: string;
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/** Step one. Captures either a saved address id or a freshly typed address. */
export async function saveAddressAction(formData: FormData): Promise<CheckoutResult> {
  const user = await getSessionUser();
  const savedAddressId = formData.get('addressId');

  if (user && typeof savedAddressId === 'string' && savedAddressId.length > 0) {
    const address = await db.address.findFirst({
      where: { id: savedAddressId, userId: user.id },
    });
    if (!address) return { ok: false, message: 'That address could not be found.' };

    await writeCheckoutState({ addressId: address.id });
    return { ok: true };
  }

  const raw = Object.fromEntries(formData.entries());
  const schema = user ? addressSchema : guestCheckoutSchema;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { email, ...address } = parsed.data as z.infer<typeof guestCheckoutSchema>;
  await writeCheckoutState({ email: user ? undefined : email, address });
  return { ok: true };
}

const placeOrderSchema = z.object({
  cardNumber: z.string().min(1, 'Card number is required').max(32),
  expiry: z.string().min(1, 'Expiry is required').max(8),
  cvc: z.string().min(1, 'CVC is required').max(4),
  idempotencyKey: z.string().min(8).max(64),
});

/**
 * Step three. The sequence matters and is asserted by the suite:
 *
 *   1. re-price the cart from the database, ignoring anything the client sent
 *   2. re-check stock for every line
 *   3. charge the gateway
 *   4. only on approval, open a transaction that decrements stock and writes the
 *      order
 *
 * A declined or errored payment must leave stock exactly as it was.
 */
export async function placeOrderAction(formData: FormData): Promise<CheckoutResult> {
  const parsed = placeOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { idempotencyKey } = parsed.data;

  // A replayed submission returns the order already created for that key.
  const existing = await db.order.findUnique({ where: { idempotencyKey } });
  if (existing) return { ok: true, orderNumber: existing.orderNumber };

  const user = await getSessionUser();
  const state = await readCheckoutState();
  if (!state) return { ok: false, message: 'Your checkout session expired. Start again.' };

  const cart = await getCart();
  if (!cart || cart.items.length === 0) {
    return { ok: false, message: 'Your cart is empty.' };
  }

  // Resolve the shipping address from the session state, not from the payment form.
  let shippingAddress: z.infer<typeof addressSchema> | null = null;
  if (state.addressId) {
    if (!user) return { ok: false, message: 'Sign in to use a saved address.' };
    const saved = await db.address.findFirst({ where: { id: state.addressId, userId: user.id } });
    if (!saved) return { ok: false, message: 'That address could not be found.' };
    shippingAddress = {
      line1: saved.line1,
      line2: saved.line2 ?? '',
      city: saved.city,
      county: saved.county,
      postalCode: saved.postalCode,
      phone: saved.phone,
      isDefault: saved.isDefault,
    };
  } else if (state.address) {
    shippingAddress = state.address;
  }

  if (!shippingAddress) return { ok: false, message: 'Add a delivery address first.' };
  if (!user && !state.email) return { ok: false, message: 'An email address is required.' };

  // Stock is re-checked here, before the gateway is called at all.
  const shortages: string[] = [];
  for (const item of cart.items) {
    const variant = await db.variant.findUnique({ where: { id: item.variantId } });
    if (!variant || variant.stockQty < item.quantity) {
      shortages.push(
        `${item.variant.product.name} (${item.variant.name}): only ${variant?.stockQty ?? 0} left`,
      );
    }
  }
  if (shortages.length > 0) {
    return { ok: false, message: `Some items are no longer available. ${shortages.join('; ')}` };
  }

  // Every figure is recomputed from the database. Nothing the client posted about
  // price, discount, shipping or total is read.
  const lines = cartToLines(cart);
  const subtotalCents = computeSubtotal(lines);
  const promo = await resolveActivePromo(subtotalCents);
  const breakdown = priceCart(lines, promo);

  const payment = await chargeGateway({
    cardNumber: parsed.data.cardNumber,
    expiry: parsed.data.expiry,
    cvc: parsed.data.cvc,
    amountCents: breakdown.totalCents,
    idempotencyKey,
  });

  if (payment.status !== 'approved') {
    return { ok: false, message: payment.message };
  }

  let orderNumber: string;
  try {
    orderNumber = await db.$transaction(async (tx) => {
      // Decrement conditionally so a concurrent checkout of the last unit cannot
      // drive stock negative: updateMany with a stock guard affects zero rows if
      // someone else got there first.
      for (const item of cart.items) {
        const updated = await tx.variant.updateMany({
          where: { id: item.variantId, stockQty: { gte: item.quantity } },
          data: { stockQty: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new Error(`OUT_OF_STOCK:${item.variant.product.name}`);
        }
      }

      const year = new Date().getFullYear();
      const priorThisYear = await tx.order.count({
        where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
      });

      const order = await tx.order.create({
        data: {
          orderNumber: formatOrderNumber(year, priorThisYear + 1),
          userId: user?.id ?? null,
          guestEmail: user ? null : (state.email ?? null),
          status: 'PAID',
          subtotalCents: breakdown.subtotalCents,
          discountCents: breakdown.discountCents,
          shippingCents: breakdown.shippingCents,
          totalCents: breakdown.totalCents,
          promoCode: promo?.code ?? null,
          shippingAddress: JSON.stringify(shippingAddress),
          idempotencyKey,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              productName: item.variant.product.name,
              variantName: item.variant.name,
              unitPriceCents: item.variant.priceCents,
              quantity: item.quantity,
              lineTotalCents: item.variant.priceCents * item.quantity,
            })),
          },
        },
      });

      if (promo) {
        await tx.promoCode.update({
          where: { code: promo.code },
          data: { usedCount: { increment: 1 } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order.orderNumber;
    });
  } catch (error) {
    // Someone else took the last unit between the stock check and the decrement.
    // The transaction rolled back, so no stock moved and no order exists; the
    // shopper is told to retry rather than being shown a half-finished order.
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('OUT_OF_STOCK:')) {
      return {
        ok: false,
        message: `${message.slice('OUT_OF_STOCK:'.length)} sold out while you were paying. Your card was not charged for this order — contact support if a charge appears.`,
      };
    }
    throw error;
  }

  await setAppliedPromoCode(null);
  await clearCheckoutState();
  revalidatePath('/cart');
  revalidatePath('/', 'layout');

  return { ok: true, orderNumber };
}

/** Calls the mock gateway over HTTP so the route's own contract is exercised. */
async function chargeGateway(input: z.infer<typeof mockPaymentSchema>): Promise<PaymentResponse> {
  const parsed = mockPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'declined',
      errorCode: 'invalid_card',
      message: parsed.error.issues[0]?.message ?? 'Those card details are not valid.',
    };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? 'localhost:3000';
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';

  try {
    const response = await fetch(`${protocol}://${host}/api/mock-payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
    return (await response.json()) as PaymentResponse;
  } catch {
    return {
      status: 'error',
      errorCode: 'gateway_unreachable',
      message: 'The payment gateway is unavailable. Please try again.',
    };
  }
}
