import { test, expect } from '../../fixtures/base';

/**
 * Pagination, per PRD 4.1 and 5: 12 per page over a 25-product catalogue, page
 * numbers plus previous and next, state held in the URL.
 *
 * 25 and 12 were chosen in the PRD precisely because they divide badly: three pages
 * where the last holds a single product. The central assertion is the walk: every
 * page visited, every slug collected, the union compared against the full catalogue.
 * Checking "page 2 shows 12 products" would pass against several broken
 * implementations; checking that the union is exactly the 25 distinct products will
 * not.
 */
const TOTAL_PRODUCTS = 25;
const PAGE_SIZE = 12;
const EXPECTED_PAGES = Math.ceil(TOTAL_PRODUCTS / PAGE_SIZE); // 3

test.describe('SK-CAT: pagination', () => {
  test('SK-CAT-040 the page count is correct for 25 products at 12 per page', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto();

    expect(await cataloguePage.totalMatches()).toBe(TOTAL_PRODUCTS);
    expect(await cataloguePage.pageCount()).toBe(EXPECTED_PAGES);
  });

  test('SK-CAT-041 walking every page yields exactly 25 distinct products', async ({
    cataloguePage,
  }) => {
    const seen: string[] = [];

    for (let page = 1; page <= EXPECTED_PAGES; page += 1) {
      await cataloguePage.goto({ sort: 'name-asc', page });
      seen.push(...(await cataloguePage.visibleSlugs()));
    }

    const distinct = new Set(seen);

    expect(
      seen.length,
      `walking ${EXPECTED_PAGES} pages should surface ${TOTAL_PRODUCTS} cards in total`,
    ).toBe(TOTAL_PRODUCTS);
    expect(distinct.size, 'every product should appear exactly once across the full walk').toBe(
      TOTAL_PRODUCTS,
    );
  });

  test('SK-CAT-042 page 1 holds a full page of products', async ({ cataloguePage }) => {
    await cataloguePage.goto({ sort: 'name-asc', page: 1 });

    expect(await cataloguePage.visibleSlugs()).toHaveLength(PAGE_SIZE);
  });

  test('SK-CAT-043 the last page holds the remainder', async ({ cataloguePage }) => {
    await cataloguePage.goto({ sort: 'name-asc', page: EXPECTED_PAGES });

    // 25 products over 12 per page leaves exactly one on page 3.
    expect(await cataloguePage.visibleSlugs()).toHaveLength(
      TOTAL_PRODUCTS - PAGE_SIZE * (EXPECTED_PAGES - 1),
    );
  });

  test('SK-CAT-044 pages do not overlap', async ({ cataloguePage }) => {
    await cataloguePage.goto({ sort: 'name-asc', page: 1 });
    const first = await cataloguePage.visibleSlugs();

    await cataloguePage.goto({ sort: 'name-asc', page: 2 });
    const second = await cataloguePage.visibleSlugs();

    const overlap = first.filter((slug) => second.includes(slug));
    expect(overlap, 'no product should appear on two pages').toEqual([]);
  });

  test('SK-CAT-045 the first product of the catalogue is reachable', async ({ cataloguePage }) => {
    // Under name-ascending sort the alphabetically first product must be on page 1.
    await cataloguePage.goto({ sort: 'name-asc', page: 1 });
    const names = await cataloguePage.visibleNames();
    const slugs = await cataloguePage.visibleSlugs();

    // Code-point order, matching the collation the database sorts with. See the
    // note in sort.spec.ts SK-CAT-062.
    const sorted = [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(names[0], 'page 1 under A–Z sort must start at the beginning of the catalogue').toBe(
      sorted[0],
    );
    expect(slugs).toContain('amazfit-bip-5-smartwatch');
  });

  test('SK-CAT-046 previous is inert on page 1 and next is inert on the last page', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ page: 1 });
    await expect(cataloguePage.paginationPrevious).toHaveAttribute('aria-disabled', 'true');

    await cataloguePage.goto({ page: EXPECTED_PAGES });
    await expect(cataloguePage.paginationNext).toHaveAttribute('aria-disabled', 'true');
  });

  test('SK-CAT-047 the current page is marked for assistive technology', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ page: 2 });

    await expect(cataloguePage.paginationPage(2)).toHaveAttribute('aria-current', 'page');
    await expect(cataloguePage.paginationPage(1)).not.toHaveAttribute('aria-current', 'page');
  });

  test('SK-CAT-048 next advances one page and changes the products shown', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ sort: 'name-asc', page: 1 });
    const first = await cataloguePage.visibleSlugs();

    await cataloguePage.paginationNext.click();
    await cataloguePage.waitForResults();

    // The old grid is still visible when the click returns, so this has to retry.
    await expect.poll(() => cataloguePage.visibleSlugs()).not.toEqual(first);
    await expect(cataloguePage.paginationPage(2)).toHaveAttribute('aria-current', 'page');
  });

  test('SK-CAT-049 filters survive paging', async ({ cataloguePage, page }) => {
    await cataloguePage.goto({ categories: ['electronics'], sort: 'name-asc' });
    const total = await cataloguePage.totalMatches();

    if ((await cataloguePage.pageCount()) > 1) {
      await cataloguePage.paginationNext.click();
      await cataloguePage.waitForResults();

      expect(page.url()).toContain('category=electronics');
      expect(await cataloguePage.totalMatches()).toBe(total);
      await expect(cataloguePage.categoryCheckbox('electronics')).toBeChecked();
    }
  });

  test('SK-CAT-050 a page number beyond the last clamps to the last page', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ page: 99 });

    // Clamping rather than erroring keeps a hand-edited URL from producing a 500.
    await expect(cataloguePage.paginationPage(EXPECTED_PAGES)).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
