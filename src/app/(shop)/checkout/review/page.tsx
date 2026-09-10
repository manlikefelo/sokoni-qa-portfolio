import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getCart, cartToLines, resolveActivePromo } from '@/lib/cart';
import { computeSubtotal, priceCart } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import { readCheckoutState } from '@/lib/checkout-session';
import { CheckoutSteps } from '@/components/checkout-steps';
import { OrderSummary } from '@/components/order-summary';

export const metadata: Metadata = { title: 'Review your order' };
export const dynamic = 'force-dynamic';

export default async function CheckoutReviewPage() {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect('/cart');

  const state = await readCheckoutState();
  if (!state) redirect('/checkout/address');

  const user = await getSessionUser();

  // The address shown here is resolved the same way order creation resolves it, so
  // what the shopper confirms is what gets written.
  let address = state.address ?? null;
  if (state.addressId && user) {
    const saved = await db.address.findFirst({ where: { id: state.addressId, userId: user.id } });
    if (saved) {
      address = {
        line1: saved.line1,
        line2: saved.line2 ?? '',
        city: saved.city,
        county: saved.county,
        postalCode: saved.postalCode,
        phone: saved.phone,
        isDefault: saved.isDefault,
      };
    }
  }
  if (!address) redirect('/checkout/address');

  const lines = cartToLines(cart);
  const promo = await resolveActivePromo(computeSubtotal(lines));
  const breakdown = priceCart(lines, promo);

  return (
    <section className="flex flex-col gap-6">
      <CheckoutSteps current="review" />
      <h1 className="text-2xl font-bold">Review your order</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-bold">Delivering to</h2>
              <Link
                href="/checkout/address"
                data-testid="edit-address-link"
                className="text-brand-600 text-sm font-medium hover:underline"
              >
                Edit
              </Link>
            </div>
            <address
              data-testid="review-address"
              className="mt-3 text-sm leading-relaxed not-italic"
            >
              {state.email && (
                <>
                  <span data-testid="review-email">{state.email}</span>
                  <br />
                </>
              )}
              {address.line1}
              {address.line2 ? (
                <>
                  <br />
                  {address.line2}
                </>
              ) : null}
              <br />
              {address.city}, {address.county} {address.postalCode}
              <br />
              {address.phone}
            </address>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-bold">Items</h2>
              <Link
                href="/cart"
                data-testid="edit-cart-link"
                className="text-brand-600 text-sm font-medium hover:underline"
              >
                Edit
              </Link>
            </div>
            <ul data-testid="review-items" className="mt-3 flex flex-col divide-y divide-slate-200">
              {cart.items.map((item) => (
                <li
                  key={item.id}
                  data-testid={`review-line-${item.variantId}`}
                  className="flex justify-between gap-4 py-3 text-sm"
                >
                  <span>
                    {item.variant.product.name}
                    <span className="text-muted block text-xs">
                      {item.variant.name} &middot; {formatMoney(item.variant.priceCents)} &times;{' '}
                      {item.quantity}
                    </span>
                  </span>
                  <span data-testid={`review-line-total-${item.variantId}`} className="font-medium">
                    {formatMoney(item.variant.priceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="flex h-fit flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Summary</h2>
          <OrderSummary breakdown={breakdown} promoCode={promo?.code ?? null} />
          <Link
            href="/checkout/payment"
            data-testid="review-continue-btn"
            className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-center text-sm font-semibold text-white"
          >
            Continue to payment
          </Link>
        </aside>
      </div>
    </section>
  );
}
