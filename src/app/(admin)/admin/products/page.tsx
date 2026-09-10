import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { ActiveToggle, StockAdjuster } from '@/components/admin-product-controls';

export const metadata: Metadata = { title: 'Admin products' };
export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const products = await db.product.findMany({
    include: { category: true, variants: { orderBy: { sku: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link
          href="/admin/products/new"
          data-testid="admin-new-product-link"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-semibold text-white"
        >
          New product
        </Link>
      </div>

      <ul data-testid="admin-product-list" className="flex flex-col gap-4">
        {products.map((product) => (
          <li
            key={product.id}
            data-testid={`admin-product-${product.slug}`}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{product.name}</h2>
                <p className="text-muted text-xs">
                  {product.category.name} &middot; {formatMoney(product.basePriceCents)} &middot;{' '}
                  <span data-testid={`admin-product-state-${product.slug}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/products/${product.id}`}
                  data-testid={`admin-edit-${product.slug}`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  Edit
                </Link>
                <ActiveToggle
                  productId={product.id}
                  slug={product.slug}
                  isActive={product.isActive}
                />
              </div>
            </div>

            <ul className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">
              {product.variants.map((variant) => (
                <li key={variant.id} className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="min-w-40 font-mono">{variant.sku}</span>
                  <span className="min-w-32">{variant.name}</span>
                  <span className="min-w-24">{formatMoney(variant.priceCents)}</span>
                  <StockAdjuster
                    variantId={variant.id}
                    sku={variant.sku}
                    stockQty={variant.stockQty}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
