import type { PromoCode } from '@prisma/client';
import { formatMoney } from './money';
import type { AppliedPromo } from './pricing';

export type PromoRejection =
  'UNKNOWN' | 'INACTIVE' | 'EXPIRED' | 'BELOW_MIN_SPEND' | 'USAGE_EXHAUSTED';

export type PromoValidation =
  { ok: true; promo: AppliedPromo } | { ok: false; reason: PromoRejection; message: string };

/**
 * Expiry is exclusive: a code is valid right up to the instant in expiresAt and
 * invalid from that instant onward. Comparison is on the full UTC timestamp, so a
 * code expiring at 23:59:59 today is still good for the rest of today.
 */
export function isExpired(promo: Pick<PromoCode, 'expiresAt'>, now: Date): boolean {
  return promo.expiresAt.getTime() <= now.getTime();
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
