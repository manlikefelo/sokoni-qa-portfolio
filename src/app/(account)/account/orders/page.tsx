import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = { title: 'Your orders' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const session = await requireUser();

  // Scoped to the signed-in user. There is no code path here that can read
  // somebody else's orders.
  const orders = await db.order.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Your orders</h1>

      {orders.length === 0 ? (
        <p data-testid="orders-empty" className="text-muted text-sm">
          You have not placed any orders yet.
        </p>
      ) : (
        <ul data-testid="orders-list" className="flex flex-col gap-3">
          {orders.map((order) => (
            <li
              key={order.id}
              data-testid={`order-row-${order.orderNumber}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm"
            >
              <div>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  data-testid={`order-link-${order.orderNumber}`}
                  className="text-brand-700 font-mono font-semibold hover:underline"
                >
                  {order.orderNumber}
                </Link>
                <p className="text-muted">
                  {order.createdAt.toISOString().slice(0, 10)} &middot; {order.items.length}{' '}
                  {order.items.length === 1 ? 'item' : 'items'}
                </p>
              </div>
              <p data-testid={`order-status-${order.orderNumber}`} className="font-medium">
                {order.status}
              </p>
              <p data-testid={`order-total-${order.orderNumber}`} className="font-bold">
                {formatMoney(order.totalCents)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
