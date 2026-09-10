import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCart, cartToLines, resolveActivePromo } from '@/lib/cart';
import { computeSubtotal, priceCart } from '@/lib/pricing';
import { readCheckoutState } from '@/lib/checkout-session';
import { CheckoutSteps } from '@/components/checkout-steps';
import { OrderSummary } from '@/components/order-summary';
import { PaymentForm } from '@/components/payment-form';

export const metadata: Metadata = { title: 'Payment' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPaymentPage() {
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect('/cart');

  const state = await readCheckoutState();
  if (!state) redirect('/checkout/address');

  const lines = cartToLines(cart);
  const promo = await resolveActivePromo(computeSubtotal(lines));
  const breakdown = priceCart(lines, promo);

  return (
    <section className="flex flex-col gap-6">
      <CheckoutSteps current="payment" />
      <h1 className="text-2xl font-bold">Payment</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <PaymentForm totalCents={breakdown.totalCents} />
        <aside className="flex h-fit flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Summary</h2>
          <OrderSummary breakdown={breakdown} promoCode={promo?.code ?? null} />
        </aside>
      </div>
    </section>
  );
}
