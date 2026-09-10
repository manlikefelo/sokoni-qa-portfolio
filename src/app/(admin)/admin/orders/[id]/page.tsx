import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { allowedTargets } from '@/lib/order-status';
import { OrderSummary } from '@/components/order-summary';
import { StatusControl } from '@/components/admin-status-control';

export const metadata: Metadata = { title: 'Order detail' };
export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, user: true },
  });
  if (!order) notFound();

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 data-testid="admin-order-number" className="text-2xl font-bold">
          {order.orderNumber}
        </h1>
        <p className="text-muted mt-1 text-sm">
          {order.user?.email ?? order.guestEmail ?? 'guest'} &middot; current status{' '}
          <span data-testid="admin-order-current-status" className="font-semibold">
            {order.status}
          </span>
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Change status</h2>
        <div className="mt-3">
          <StatusControl
            orderId={order.id}
            currentStatus={order.status}
            allowedTargets={allowedTargets(order.status)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Items</h2>
        <ul className="mt-3 divide-y divide-slate-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
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
    </section>
  );
}
