import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findProductBySlug } from '@/lib/catalogue';
import { AddToCartForm } from '@/components/add-to-cart-form';

// The product lookup decides between rendering a page and returning a 404, so it
// has to resolve before the response is committed. A loading.tsx covering this
// segment would wrap it in a Suspense boundary, stream a 200 shell, and lose the
// 404 status, which is why the skeletons live on the sibling routes instead.
export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await findProductBySlug(slug);

  // An unknown slug and an inactive product are indistinguishable from outside.
  if (!product) notFound();

  return (
    <article className="grid gap-10 md:grid-cols-2">
      <nav aria-label="Breadcrumb" className="md:col-span-2">
        <ol className="text-muted flex flex-wrap items-center gap-2 text-sm">
          <li>
            <Link href="/products" data-testid="breadcrumb-shop" className="hover:underline">
              Shop
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/products?category=${product.category.slug}`}
              data-testid="breadcrumb-category"
              className="hover:underline"
            >
              {product.category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <Image
        src={product.imageUrl}
        alt={product.name}
        width={640}
        height={640}
        priority
        data-testid="product-image"
        className="w-full rounded-lg border border-slate-200 bg-white object-cover"
      />

      <div className="flex flex-col gap-5">
        <header>
          <h1 data-testid="product-name" className="text-2xl leading-tight font-bold">
            {product.name}
          </h1>
          <p className="text-muted mt-1 text-sm">{product.category.name}</p>
        </header>

        <p data-testid="product-description" className="text-sm leading-relaxed text-slate-700">
          {product.description}
        </p>

        <AddToCartForm
          variants={product.variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            sku: variant.sku,
            priceCents: variant.priceCents,
            stockQty: variant.stockQty,
          }))}
        />

        <Link
          href="/cart"
          data-testid="go-to-cart-link"
          className="text-brand-600 text-sm font-medium hover:underline"
        >
          View cart
        </Link>
      </div>
    </article>
  );
}
