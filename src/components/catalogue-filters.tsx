'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { Category } from '@prisma/client';
import { SORT_OPTIONS } from '@/schemas/catalogue';

/**
 * All catalogue state lives in the query string, which makes a filtered view
 * shareable and lets it survive a reload. Every control writes back to the URL and
 * resets to page 1, because a filter change invalidates the current page number.
 */
export function CatalogueFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const selectedCategories = params.getAll('category');

  const push = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete('page');
      const query = next.toString();
      router.push(query ? `/products?${query}` : '/products');
    },
    [params, router],
  );

  const setSingle = (key: string, value: string) =>
    push((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

  const toggleCategory = (slug: string, checked: boolean) =>
    push((next) => {
      const remaining = next.getAll('category').filter((item) => item !== slug);
      next.delete('category');
      for (const item of remaining) next.append('category', item);
      if (checked) next.append('category', slug);
    });

  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-muted';
  const inputClass = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm';

  return (
    <form
      role="search"
      aria-label="Filter products"
      data-testid="catalogue-filters"
      onSubmit={(event) => {
        event.preventDefault();
        const field = event.currentTarget.elements.namedItem('q');
        if (field instanceof HTMLInputElement) setSingle('q', field.value.trim());
      }}
      className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <label className={labelClass} htmlFor="filter-search">
          Search
        </label>
        <input
          id="filter-search"
          name="q"
          data-testid="search-input"
          type="search"
          className={inputClass}
          defaultValue={params.get('q') ?? ''}
          placeholder="Search products"
        />
        <button
          type="submit"
          data-testid="search-submit"
          className="bg-brand-600 hover:bg-brand-700 mt-2 w-full rounded-md px-3 py-1.5 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>

      <fieldset>
        <legend className={labelClass}>Category</legend>
        <div className="mt-2 flex flex-col gap-2">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid={`filter-category-${category.slug}`}
                checked={selectedCategories.includes(category.slug)}
                onChange={(event) => toggleCategory(category.slug, event.target.checked)}
                className="size-4"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Price range (KSh)</legend>
        <div className="mt-2 flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-price-min">
            Minimum price in shillings
          </label>
          <input
            id="filter-price-min"
            data-testid="filter-price-min"
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            placeholder="Min"
            defaultValue={centsParamToShillings(params.get('minPrice'))}
            onBlur={(event) => setSingle('minPrice', shillingsToCentsParam(event.target.value))}
          />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor="filter-price-max">
            Maximum price in shillings
          </label>
          <input
            id="filter-price-max"
            data-testid="filter-price-max"
            type="number"
            min={0}
            inputMode="numeric"
            className={inputClass}
            placeholder="Max"
            defaultValue={centsParamToShillings(params.get('maxPrice'))}
            onBlur={(event) => setSingle('maxPrice', shillingsToCentsParam(event.target.value))}
          />
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="filter-in-stock"
          checked={params.get('inStock') === 'true'}
          onChange={(event) => setSingle('inStock', event.target.checked ? 'true' : '')}
          className="size-4"
        />
        In stock only
      </label>

      <div>
        <label className={labelClass} htmlFor="sort-select">
          Sort by
        </label>
        <select
          id="sort-select"
          data-testid="sort-select"
          className={inputClass}
          value={params.get('sort') ?? 'newest'}
          onChange={(event) => setSingle('sort', event.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        data-testid="filters-clear"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        onClick={() => router.push('/products')}
      >
        Clear all filters
      </button>
    </form>
  );
}

const SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'name-asc': 'Name: A to Z',
};

/** The URL carries cents; the filter inputs are in whole shillings. */
function centsParamToShillings(value: string | null): string {
  if (!value) return '';
  const cents = Number(value);
  return Number.isFinite(cents) ? String(Math.round(cents / 100)) : '';
}

function shillingsToCentsParam(value: string): string {
  const shillings = Number(value.trim());
  if (!value.trim() || !Number.isFinite(shillings) || shillings < 0) return '';
  return String(Math.round(shillings * 100));
}
