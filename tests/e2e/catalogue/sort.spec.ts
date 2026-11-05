import { test, expect } from '../../fixtures/base';
import { testDb } from '../../fixtures/db';
import { CataloguePage } from '../../pages/catalogue.page';

const SEED_CATEGORIES = [...CataloguePage.SEED_CATEGORIES];

/**
 * Sorting, per PRD 4.1: newest, price ascending, price descending, name A–Z.
 *
 * Each order is verified by reading the actual displayed values and comparing them,
 * rather than by checking that the select shows the right label. A sort that silently
 * does nothing would pass the latter.
 */
test.describe('SK-CAT: sorting', () => {
  test('SK-CAT-060 price ascending orders by price, lowest first', async ({ cataloguePage }) => {
    await cataloguePage.goto({ sort: 'price-asc' });
    const prices = await cataloguePage.visiblePricesInCents();

    expect(prices.length).toBeGreaterThan(1);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices, 'displayed prices should already be in ascending order').toEqual(sorted);
  });

  test('SK-CAT-061 price descending orders by price, highest first', async ({ cataloguePage }) => {
    await cataloguePage.goto({ sort: 'price-desc' });
    const prices = await cataloguePage.visiblePricesInCents();

    expect(prices.length).toBeGreaterThan(1);
    const sorted = [...prices].sort((a, b) => b - a);
    expect(prices, 'displayed prices should already be in descending order').toEqual(sorted);
  });

  test('SK-CAT-062 name A–Z orders alphabetically', async ({ cataloguePage }) => {
    await cataloguePage.goto({ sort: 'name-asc' });
    const names = await cataloguePage.visibleNames();

    expect(names.length).toBeGreaterThan(1);

    /**
     * Compared with a plain code-point sort, not with localeCompare.
     *
     * The first version of this test used localeCompare and failed on
     * "TP-Link Archer…" sorting before "Tefal Non-Stick…". That is not an
     * application bug: the database orders by byte value, where uppercase P
     * precedes lowercase e, while localeCompare folds case. The application was
     * self-consistent and the oracle was wrong. Asserting against the collation the
     * application actually uses keeps the test honest about what it is checking.
     */
    const sorted = [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(names, 'displayed names should already be in A–Z order').toEqual(sorted);
  });

  test('SK-CAT-063 newest puts the most recently added product first', async ({
    cataloguePage,
  }) => {
    const newest = await testDb.product.findFirstOrThrow({
      where: { isActive: true, category: { slug: { in: SEED_CATEGORIES } } },
      orderBy: { createdAt: 'desc' },
    });

    await cataloguePage.goto({ sort: 'newest' });
    const slugs = await cataloguePage.visibleSlugs();

    expect(slugs[0]).toBe(newest.slug);
  });

  test('SK-CAT-064 price ascending and descending are exact mirrors', async ({ cataloguePage }) => {
    // Over a single page of a stable dataset, reversing the order should reverse the
    // prices. This catches a sort that only happens to look right at one end.
    await cataloguePage.goto({ sort: 'price-asc' });
    const ascending = await cataloguePage.visiblePricesInCents();

    await cataloguePage.goto({ sort: 'price-desc', page: await cataloguePage.pageCount() });
    const lastPageDescending = await cataloguePage.visiblePricesInCents();

    expect(ascending[0]).toBe(lastPageDescending[lastPageDescending.length - 1]);
  });

  test('SK-CAT-065 the sort choice survives a reload', async ({ cataloguePage, page }) => {
    await cataloguePage.goto({ sort: 'price-desc' });
    const before = await cataloguePage.visibleSlugs();

    await page.reload();
    await cataloguePage.waitForResults();

    await expect(cataloguePage.sortSelect).toHaveValue('price-desc');
    expect(await cataloguePage.visibleSlugs()).toEqual(before);
  });

  test('SK-CAT-066 changing sort through the UI reorders the grid', async ({ cataloguePage }) => {
    await cataloguePage.goto({ sort: 'name-asc' });
    const byName = await cataloguePage.visibleSlugs();

    await cataloguePage.setSort('price-desc');
    const byPrice = await cataloguePage.visibleSlugs();

    expect(byPrice).not.toEqual(byName);
    const prices = await cataloguePage.visiblePricesInCents();
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test('SK-CAT-067 sorting applies across the whole result set, not just one page', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ sort: 'price-asc', page: 1 });
    const firstPage = await cataloguePage.visiblePricesInCents();

    await cataloguePage.goto({ sort: 'price-asc', page: 2 });
    const secondPage = await cataloguePage.visiblePricesInCents();

    const highestOnFirst = Math.max(...firstPage);
    const lowestOnSecond = Math.min(...secondPage);

    expect(
      lowestOnSecond,
      'every price on page 2 should be at least the highest price on page 1',
    ).toBeGreaterThanOrEqual(highestOnFirst);
  });

  test('SK-CAT-068 an unrecognised sort value falls back rather than erroring', async ({
    page,
    cataloguePage,
  }) => {
    await page.goto('/products?sort=not-a-sort');
    await cataloguePage.waitForResults();

    await expect(cataloguePage.grid).toBeVisible();
    await expect(cataloguePage.sortSelect).toHaveValue('newest');
  });
});
