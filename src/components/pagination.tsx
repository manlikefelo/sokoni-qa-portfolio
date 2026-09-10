import Link from 'next/link';

/**
 * Page links preserve every other query parameter, so a filtered, sorted view
 * stays intact while paging through it.
 */
export function Pagination({
  page,
  pageCount,
  buildHref,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const base = 'rounded-md border px-3 py-1.5 text-sm font-medium';

  return (
    <nav aria-label="Pagination" data-testid="pagination" className="flex flex-wrap gap-2">
      <Link
        href={buildHref(page - 1)}
        data-testid="pagination-prev"
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={`${base} ${page <= 1 ? 'pointer-events-none border-slate-200 text-slate-400' : 'border-slate-300 hover:bg-slate-50'}`}
      >
        Previous
      </Link>

      {pages.map((value) => (
        <Link
          key={value}
          href={buildHref(value)}
          data-testid={`pagination-page-${value}`}
          aria-current={value === page ? 'page' : undefined}
          className={`${base} ${
            value === page
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-300 hover:bg-slate-50'
          }`}
        >
          {value}
        </Link>
      ))}

      <Link
        href={buildHref(page + 1)}
        data-testid="pagination-next"
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
        className={`${base} ${page >= pageCount ? 'pointer-events-none border-slate-200 text-slate-400' : 'border-slate-300 hover:bg-slate-50'}`}
      >
        Next
      </Link>
    </nav>
  );
}
