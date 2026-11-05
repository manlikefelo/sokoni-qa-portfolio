import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { OrderSummary } from '@/components/order-summary';

export const metadata: Metadata = { title: 'Order confirmed' };
export const dynamic = 'force-dynamic';

interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
}

function parseAddress(raw: string): ShippingAddress | null {
  try {
    return JSON.parse(raw) as ShippingAddress;
  } catch {
    return null;
  }
}

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });
  if (!order) notFound();

  // A signed-in shopper may only see their own orders. A guest order stays
  // reachable by its order number, which is how a guest returns to it.
  const user = await getSessionUser();
  if (order.userId && order.userId !== user?.id) notFound();

  const address = parseAddress(order.shippingAddress);

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-lg border border-green-300 bg-green-50 p-6">
        <h1 data-testid="confirmation-heading" className="text-2xl font-bold text-green-900">
          Thank you, your order is confirmed
        </h1>
        <p className="mt-2 text-sm text-green-900">
          Order number{' '}
          <span data-testid="confirmation-order-number" className="font-mono font-bold">
            {order.orderNumber}
          </span>
          . A confirmation has been sent to{' '}
          <span data-testid="confirmation-email">{order.guestEmail ?? user?.email}</span>.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Items</h2>
        <ul className="mt-3 divide-y divide-slate-200">
          {order.items.map((item) => (
            <li
              key={item.id}
              data-testid={`confirmation-item-${item.variantId}`}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <span>
                {item.productName}
                <span className="text-muted block text-xs">
                  {item.variantName} &middot; {formatMoney(item.unitPriceCents)} &times;{' '}
                  {item.quantity}
                </span>
              </span>
              <span className="font-medium">{formatMoney(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <OrderSummary
            breakdown={{
              subtotalCents: order.subtotalCents,
              discountCents: order.discountCents,
              shippingCents: order.shippingCents,
              totalCents: order.totalCents,
            }}
            promoCode={order.promoCode}
          />
        </div>
      </div>

      {address && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Delivery address</h2>
          <address
            data-testid="confirmation-address"
            className="mt-2 text-sm leading-relaxed not-italic"
          >
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
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/products"
          data-testid="confirmation-continue-link"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-sm font-semibold text-white"
        >
          Keep shopping
        </Link>
        {user && (
          <Link
            href="/account/orders"
            data-testid="confirmation-orders-link"
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            View your orders
          </Link>
        )}
      </div>
    </section>
  );
}
