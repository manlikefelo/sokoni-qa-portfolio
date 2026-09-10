import type { PromoCode } from '@prisma/client';
import { formatMoney } from './money';
import type { AppliedPromo } from './pricing';

export type PromoRejection =
  'UNKNOWN' | 'INACTIVE' | 'EXPIRED' | 'BELOW_MIN_SPEND' | 'USAGE_EXHAUSTED';

export type PromoValidation =
  { ok: true; promo: AppliedPromo } | { ok: false; reason: PromoRejection; message: string };

/** Truncates a timestamp to midnight UTC so expiry compares whole days. */
function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * A code is valid until its expiry date. Comparison is made on the calendar date
 * rather than the exact timestamp.
 */
export function isExpired(promo: Pick<PromoCode, 'expiresAt'>, now: Date): boolean {
  return startOfUtcDay(promo.expiresAt) <= startOfUtcDay(now);
}

export function validatePromo(
  promo: PromoCode | null,
  subtotalCents: number,
  now: Date,
): PromoValidation {
  if (!promo) {
    return { ok: false, reason: 'UNKNOWN', message: 'That promo code is not recognised.' };
  }
  if (!promo.isActive) {
    return { ok: false, reason: 'INACTIVE', message: 'That promo code is no longer available.' };
  }
  if (isExpired(promo, now)) {
    return { ok: false, reason: 'EXPIRED', message: 'That promo code has expired.' };
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return {
      ok: false,
      reason: 'USAGE_EXHAUSTED',
      message: 'That promo code has reached its usage limit.',
    };
  }
  if (subtotalCents < promo.minSpendCents) {
    return {
      ok: false,
      reason: 'BELOW_MIN_SPEND',
      message: `Spend at least ${formatMoney(promo.minSpendCents)} to use this code.`,
    };
  }
  return {
    ok: true,
    promo: {
      code: promo.code,
      type: promo.type,
      value: promo.value,
      minSpendCents: promo.minSpendCents,
    },
  };
}
