import Link from 'next/link';

export default function NotFound() {
  return (
    <div data-testid="not-found" className="flex flex-col items-start gap-4 py-10">
      <h1 className="text-2xl font-bold">We could not find that page</h1>
      <p className="text-muted text-sm">
        The link may be out of date, or the item may no longer be on sale.
      </p>
      <Link
        href="/products"
        data-testid="not-found-shop-link"
        className="bg-brand-600 hover:bg-brand-700 rounded-md px-5 py-2.5 text-sm font-semibold text-white"
      >
        Browse the shop
      </Link>
    </div>
  );
}
