import Link from 'next/link';
import type { Metadata } from 'next';
import type { OrderStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { orderStatusSchema } from '@/schemas/admin';

export const metadata: Metadata = { title: 'Admin orders' };
export const dynamic = 'force-dynamic';

const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const parsed = orderStatusSchema.safeParse(status);
  const where: Prisma.OrderWhereInput = parsed.success ? { status: parsed.data } : {};

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true, user: true },
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Orders</h1>

      <nav aria-label="Filter by status" data-testid="admin-status-filter">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="/admin/orders"
              data-testid="admin-filter-all"
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                parsed.success
                  ? 'border-slate-300 hover:bg-slate-50'
                  : 'border-brand-600 bg-brand-600 text-white'
              }`}
            >
              All
            </Link>
          </li>
          {ALL_STATUSES.map((value) => (
            <li key={value}>
              <Link
                href={`/admin/orders?status=${value}`}
                data-testid={`admin-filter-${value}`}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  parsed.success && parsed.data === value
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                {value}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <p data-testid="admin-orders-empty" className="text-muted text-sm">
          No orders match that filter.
        </p>
      ) : (
        <ul data-testid="admin-orders-list" className="flex flex-col gap-3">
          {orders.map((order) => (
            <li
              key={order.id}
              data-testid={`admin-order-${order.orderNumber}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm"
            >
              <div>
                <Link
                  href={`/admin/orders/${order.id}`}
                  data-testid={`admin-order-link-${order.orderNumber}`}
                  className="text-brand-700 font-mono font-semibold hover:underline"
                >
                  {order.orderNumber}
                </Link>
                <p className="text-muted text-xs">
                  {order.user?.email ?? order.guestEmail ?? 'guest'} &middot;{' '}
                  {order.createdAt.toISOString().slice(0, 10)}
                </p>
              </div>
              <p data-testid={`admin-order-status-${order.orderNumber}`} className="font-medium">
                {order.status}
              </p>
              <p className="font-bold">{formatMoney(order.totalCents)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
