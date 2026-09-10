import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { OrderSummary } from '@/components/order-summary';

export const metadata: Metadata = { title: 'Order detail' };
export const dynamic = 'force-dynamic';

interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await requireUser();
  const { orderNumber } = await params;

  /**
   * The ownership check is part of the query, not a branch after it. Asking for
   * somebody else's order yields 404 rather than 403 — a 403 would confirm the
   * order exists, which is information the caller has no right to.
   */
  const order = await db.order.findFirst({
    where: { orderNumber, userId: session.id },
    include: { items: true },
  });
  if (!order) notFound();

  let address: ShippingAddress | null = null;
  try {
    address = JSON.parse(order.shippingAddress) as ShippingAddress;
  } catch {
    address = null;
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 data-testid="order-detail-number" className="text-2xl font-bold">
          Order {order.orderNumber}
        </h1>
        <p className="text-muted mt-1 text-sm">
          Placed {order.createdAt.toISOString().slice(0, 10)} &middot; status{' '}
          <span data-testid="order-detail-status" className="font-semibold">
            {order.status}
          </span>
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Items</h2>
        <ul className="mt-3 divide-y divide-slate-200">
          {order.items.map((item) => (
            <li
              key={item.id}
              data-testid={`order-item-${item.variantId}`}
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
            data-testid="order-detail-address"
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
    </section>
  );
}
