import { Suspense } from 'react';
import type { Metadata } from 'next';
import { findCategories, findProducts, toCategoryList } from '@/lib/catalogue';
import { catalogueQuerySchema, PAGE_SIZE } from '@/schemas/catalogue';
import { ProductCard } from '@/components/product-card';
import { CatalogueFilters } from '@/components/catalogue-filters';
import { Pagination } from '@/components/pagination';

export const metadata: Metadata = { title: 'Shop' };
export const dynamic = 'force-dynamic';

function GridSkeleton() {
  return (
    <div
      data-testid="route-loading"
      role="status"
      aria-live="polite"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">Loading products</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-72 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

/** Rebuilds the current query string with a different page number. */
function hrefForPage(params: SearchParams, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) next.append(key, item);
  }
  if (page > 1) next.set('page', String(page));
  const query = next.toString();
  return query ? `/products?${query}` : '/products';
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const categories = await findCategories();

  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <aside>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-slate-200" />}>
          <CatalogueFilters categories={categories} />
        </Suspense>
      </aside>

      {/*
        The result grid is suspended on its own rather than behind a segment-level
        loading.tsx. A loading.tsx on this segment would also wrap products/[slug],
        stream a 200 shell for it, and cost an unknown slug its 404 status.
      */}
      <Suspense key={JSON.stringify(raw)} fallback={<GridSkeleton />}>
        <CatalogueResults raw={raw} />
      </Suspense>
    </div>
  );
}

async function CatalogueResults({ raw }: { raw: SearchParams }) {
  const query = catalogueQuerySchema.parse(raw);
  const { products, totalCount, pageCount, page } = await findProducts(query);

  const activeFilters =
    Boolean(query.q) ||
    toCategoryList(query.category).length > 0 ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.inStock === 'true';

  const firstOnPage = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <section aria-labelledby="catalogue-heading">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h1 id="catalogue-heading" className="text-2xl font-bold">
          Shop
        </h1>
        <p data-testid="result-count" className="text-muted text-sm">
          {totalCount === 0
            ? 'No products found'
            : `Showing ${firstOnPage}–${lastOnPage} of ${totalCount} products`}
        </p>
      </div>

      {products.length === 0 ? (
        <div
          data-testid="empty-state"
          className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"
        >
          <h2 className="text-lg font-semibold">Nothing matches those filters</h2>
          <p className="text-muted mt-2 text-sm">
            {activeFilters
              ? 'Try widening the price range or clearing a category.'
              : 'The catalogue is empty.'}
          </p>
        </div>
      ) : (
        <div
          data-testid="product-grid"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <Pagination
          page={page}
          pageCount={pageCount}
          buildHref={(target) => hrefForPage(raw, target)}
        />
      </div>
    </section>
  );
}
