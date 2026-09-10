import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const [productCount, activeCount, orderCount, outOfStock, revenue] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.order.count(),
    db.variant.count({ where: { stockQty: 0 } }),
    db.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { notIn: ['PENDING', 'CANCELLED'] } },
    }),
  ]);

  const tiles = [
    { label: 'Products', value: String(productCount), testId: 'stat-products' },
    { label: 'Active products', value: String(activeCount), testId: 'stat-active-products' },
    { label: 'Orders', value: String(orderCount), testId: 'stat-orders' },
    { label: 'Variants out of stock', value: String(outOfStock), testId: 'stat-out-of-stock' },
    {
      label: 'Revenue booked',
      value: formatMoney(revenue._sum.totalCents ?? 0),
      testId: 'stat-revenue',
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Admin overview</h1>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.testId} className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-muted text-xs font-semibold tracking-wide uppercase">
              {tile.label}
            </dt>
            <dd data-testid={tile.testId} className="mt-1 text-xl font-bold">
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
