import Link from 'next/link';
import type { Metadata } from 'next';
import { getCart, cartToLines, readAppliedPromoCode, resolveActivePromo } from '@/lib/cart';
import { priceCart, computeSubtotal } from '@/lib/pricing';
import { CartLine } from '@/components/cart-line';
import { PromoForm } from '@/components/promo-form';
import { OrderSummary } from '@/components/order-summary';

export const metadata: Metadata = { title: 'Your cart' };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await getCart();
  const lines = cartToLines(cart);
  const subtotalCents = computeSubtotal(lines);

  // A code entered earlier may no longer qualify if the cart has since changed, so
  // it is revalidated against the current subtotal on every render.
  const promo = await resolveActivePromo(subtotalCents);
  const enteredCode = await readAppliedPromoCode();
  const breakdown = priceCart(lines, promo);

  if (!cart || cart.items.length === 0) {
    return (
      <section aria-labelledby="cart-heading" className="flex flex-col gap-4">
        <h1 id="cart-heading" className="text-2xl font-bold">
          Your cart
        </h1>
        <div
          data-testid="cart-empty"
          className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"
        >
          <h2 className="text-lg font-semibold">Your cart is empty</h2>
          <p className="text-muted mt-2 text-sm">Nothing added yet.</p>
          <Link
            href="/products"
            data-testid="cart-empty-shop-link"
            className="bg-brand-600 hover:bg-brand-700 mt-5 inline-block rounded-md px-5 py-2.5 text-sm font-semibold text-white"
          >
            Browse the shop
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="cart-heading" className="flex flex-col gap-6">
      <h1 id="cart-heading" className="text-2xl font-bold">
        Your cart
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul data-testid="cart-lines" className="rounded-lg border border-slate-200 bg-white px-4">
          {cart.items.map((item) => (
            <CartLine
              key={item.id}
              line={{
                variantId: item.variantId,
                productName: item.variant.product.name,
                productSlug: item.variant.product.slug,
                variantName: item.variant.name,
                imageUrl: item.variant.product.imageUrl,
                unitPriceCents: item.variant.priceCents,
                quantity: item.quantity,
                stockQty: item.variant.stockQty,
              }}
            />
          ))}
        </ul>

        <aside className="flex h-fit flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Summary</h2>

          <PromoForm appliedCode={promo ? promo.code : null} />

          {enteredCode && !promo && (
            <p data-testid="promo-dropped" className="text-xs text-amber-700">
              The code {enteredCode} no longer applies to this cart.
            </p>
          )}

          <OrderSummary breakdown={breakdown} promoCode={promo?.code ?? null} />

          {breakdown.shippingCents > 0 && (
            <p className="text-muted text-xs">
              Spend KSh{' '}
              {(
                (500_000 - (breakdown.subtotalCents - breakdown.discountCents)) /
                100
              ).toLocaleString('en-KE')}{' '}
              more for free delivery.
            </p>
          )}

          <Link
            href="/checkout/address"
            data-testid="checkout-btn"
            className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-center text-sm font-semibold text-white"
          >
            Proceed to checkout
          </Link>

          <Link
            href="/products"
            data-testid="continue-shopping-link"
            className="text-brand-600 text-center text-sm font-medium hover:underline"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </section>
  );
}
