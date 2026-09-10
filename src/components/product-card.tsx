import Link from 'next/link';
import Image from 'next/image';
import { formatMoney } from '@/lib/money';
import { isOutOfStock, lowestVariantPrice, type ProductListItem } from '@/lib/catalogue';

export function ProductCard({ product }: { product: ProductListItem }) {
  const soldOut = isOutOfStock(product);
  const price = lowestVariantPrice(product);
  const hasRange = product.variants.some((variant) => variant.priceCents !== price);

  return (
    <article
      data-testid={`product-card-${product.slug}`}
      className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:shadow-md"
    >
      <Link href={`/products/${product.slug}`} className="block" tabIndex={-1} aria-hidden="true">
        <Image
          src={product.imageUrl}
          alt=""
          width={400}
          height={400}
          className="aspect-square w-full object-cover"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-sm leading-snug font-semibold">
          <Link
            href={`/products/${product.slug}`}
            data-testid={`product-link-${product.slug}`}
            className="hover:text-brand-600"
          >
            {product.name}
          </Link>
        </h2>

        <p className="text-muted text-xs">{product.category.name}</p>

        <p className="mt-auto text-base font-bold" data-testid={`product-price-${product.slug}`}>
          {hasRange ? `From ${formatMoney(price)}` : formatMoney(price)}
        </p>

        {soldOut && (
          <p
            data-testid={`out-of-stock-${product.slug}`}
            className="w-fit rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold tracking-wide text-slate-700 uppercase"
          >
            Out of stock
          </p>
        )}
      </div>
    </article>
  );
}
