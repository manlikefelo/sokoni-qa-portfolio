/**
 * The pricing engine. Pure functions only — no database access, no request
 * context, no clock reads beyond what is passed in. Everything here is
 * recomputed server-side at order creation; a client-supplied total is never
 * trusted or even read.
 */
import { roundHalfUp } from './money';

export const FREE_SHIPPING_THRESHOLD_CENTS = 500_000; // KSh 5,000
export const STANDARD_SHIPPING_CENTS = 35_000; // KSh 350

export type DiscountKind = 'PERCENTAGE' | 'FIXED';

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
}

export interface AppliedPromo {
  code: string;
  type: DiscountKind;
  value: number;
  minSpendCents: number;
}

export interface PriceBreakdown {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
}

export function computeSubtotal(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

/**
 * A percentage discount is computed once against the whole subtotal and rounded
 * once. Rounding each line separately and summing produces drift of a shilling
 * or two on some quantity/price combinations.
 */
export function computeDiscount(subtotalCents: number, promo: AppliedPromo): number {
  if (subtotalCents < promo.minSpendCents) return 0;
  const raw =
    promo.type === 'PERCENTAGE' ? roundHalfUp((subtotalCents * promo.value) / 100) : promo.value;
  return Math.min(Math.max(raw, 0), subtotalCents);
}

/** Shipping is assessed on the post-discount subtotal, not the gross subtotal. */
export function computeShipping(postDiscountCents: number): number {
  return postDiscountCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : STANDARD_SHIPPING_CENTS;
}

export function priceCart(
  lines: readonly PricedLine[],
  promo: AppliedPromo | null,
): PriceBreakdown {
  const subtotalCents = computeSubtotal(lines);
  if (subtotalCents === 0) {
    return { subtotalCents: 0, discountCents: 0, shippingCents: 0, totalCents: 0 };
  }
  const discountCents = promo ? computeDiscount(subtotalCents, promo) : 0;
  const shippingCents = computeShipping(subtotalCents - discountCents);
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: subtotalCents - discountCents + shippingCents,
  };
}
