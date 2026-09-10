import { formatMoney } from '@/lib/money';
import type { PriceBreakdown } from '@/lib/pricing';

/**
 * The single place subtotal, discount, shipping and total are rendered. Cart,
 * checkout review and the confirmation page all read from here, so the figures
 * cannot drift between screens.
 */
export function OrderSummary({
  breakdown,
  promoCode,
}: {
  breakdown: PriceBreakdown;
  promoCode?: string | null;
}) {
  const rows = [
    { label: 'Subtotal', value: breakdown.subtotalCents, testId: 'cart-subtotal' },
    ...(breakdown.discountCents > 0
      ? [
          {
            label: promoCode ? `Discount (${promoCode})` : 'Discount',
            value: -breakdown.discountCents,
            testId: 'cart-discount',
          },
        ]
      : []),
    {
      label: breakdown.shippingCents === 0 ? 'Shipping (free)' : 'Shipping',
      value: breakdown.shippingCents,
      testId: 'cart-shipping',
    },
  ];

  return (
    <dl data-testid="order-summary" className="flex flex-col gap-2 text-sm">
      {rows.map((row) => (
        <div key={row.testId} className="flex justify-between gap-4">
          <dt>{row.label}</dt>
          <dd data-testid={row.testId} className="font-medium">
            {formatMoney(row.value)}
          </dd>
        </div>
      ))}
      <div className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd data-testid="cart-total">{formatMoney(breakdown.totalCents)}</dd>
      </div>
    </dl>
  );
}
