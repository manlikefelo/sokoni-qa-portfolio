import Link from 'next/link';
import { findCategories, findProducts } from '@/lib/catalogue';
import { catalogueQuerySchema } from '@/schemas/catalogue';
import { ProductCard } from '@/components/product-card';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const query = catalogueQuerySchema.parse({ sort: 'newest', page: 1 });
  const [{ products }, categories] = await Promise.all([findProducts(query), findCategories()]);
  const featured = products.slice(0, 6);

  return (
    <div className="flex flex-col gap-12">
      <section className="bg-brand-700 rounded-xl px-6 py-12 text-white sm:px-10">
        <h1 className="max-w-2xl text-3xl leading-tight font-bold sm:text-4xl">
          Everyday essentials, delivered across Kenya
        </h1>
        <p className="text-brand-100 mt-3 max-w-xl">
          Electronics, kitchen kit and clothing at honest prices. Free delivery on orders over
          KSh&nbsp;5,000.
        </p>
        <Link
          href="/products"
          data-testid="hero-shop-btn"
          className="text-brand-700 hover:bg-brand-50 mt-6 inline-block rounded-md bg-white px-5 py-2.5 text-sm font-semibold"
        >
          Browse the shop
        </Link>
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="text-xl font-bold">
          Shop by category
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${category.slug}`}
                data-testid={`category-tile-${category.slug}`}
                className="hover:border-brand-500 hover:text-brand-700 block rounded-lg border border-slate-200 bg-white p-5 font-semibold"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="featured-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="featured-heading" className="text-xl font-bold">
            New arrivals
          </h2>
          <Link
            href="/products"
            data-testid="view-all-link"
            className="text-brand-600 text-sm font-medium hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
