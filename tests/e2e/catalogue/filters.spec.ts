import { test, expect } from '../../fixtures/base';
import { testDb } from '../../fixtures/db';
import { CataloguePage } from '../../pages/catalogue.page';

const SEED_CATEGORIES = [...CataloguePage.SEED_CATEGORIES];

/**
 * Filters, per PRD 4.1: category multi-select, price range with both bounds
 * inclusive, and in-stock only.
 *
 * The price bound cases are the substance here. A filter that works in the middle of
 * a range tells you nothing; the question is what happens at exactly the boundary,
 * which is where off-by-one errors live.
 */
test.describe('SK-CAT — catalogue filters', () => {
  test('SK-CAT-020 a single category narrows to that category', async ({ cataloguePage }) => {
    await cataloguePage.goto({ categories: ['fashion'] });

    const expected = await testDb.product.count({
      where: { isActive: true, category: { slug: 'fashion' } },
    });
    expect(await cataloguePage.totalMatches()).toBe(expected);
  });

  test('SK-CAT-021 two categories return the union of both', async ({ cataloguePage }) => {
    await cataloguePage.goto({ categories: ['fashion', 'electronics'] });

    const expected = await testDb.product.count({
      where: { isActive: true, category: { slug: { in: ['fashion', 'electronics'] } } },
    });
    expect(await cataloguePage.totalMatches()).toBe(expected);
  });

  test('SK-CAT-022 all three categories return the whole catalogue', async ({ cataloguePage }) => {
    await cataloguePage.goto({ categories: ['fashion', 'electronics', 'home-kitchen'] });

    expect(await cataloguePage.totalMatches()).toBe(25);
  });

  test('SK-CAT-023 toggling a category through the UI updates the URL and results', async ({
    cataloguePage,
    page,
  }) => {
    // Starts from an unfiltered view so that ticking one box narrows the set rather
    // than adding to an existing selection.
    await cataloguePage.goto({ categories: [] });
    await cataloguePage.toggleCategory('fashion');

    await expect(page).toHaveURL(/category=fashion/);
    const expected = await testDb.product.count({
      where: { isActive: true, category: { slug: 'fashion' } },
    });
    expect(await cataloguePage.totalMatches()).toBe(expected);
  });

  /**
   * The minimum bound. A product priced at exactly the minimum must be included.
   * The Oraimo power bank sits at exactly KSh 3,450.
   */
  test('SK-CAT-024 a product at exactly the minimum price is included', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ minPriceShillings: 3450, sort: 'price-asc' });

    const expected = await testDb.product.count({
      where: {
        isActive: true,
        category: { slug: { in: SEED_CATEGORIES } },
        variants: { some: { priceCents: { gte: 345_000 } } },
      },
    });
    expect(
      await cataloguePage.totalMatches(),
      'a minimum of 3,450 must include the product priced at exactly 3,450',
    ).toBe(expected);
  });

  /**
   * The maximum bound — the mirror of the test above, and the one that matters. The
   * PRD states both bounds are inclusive, so a product at exactly the maximum must
   * appear.
   */
  test('SK-CAT-025 a product at exactly the maximum price is included', async ({
    cataloguePage,
  }) => {
    const expected = await testDb.product.count({
      where: {
        isActive: true,
        category: { slug: { in: SEED_CATEGORIES } },
        variants: { some: { priceCents: { lte: 345_000 } } },
      },
    });

    await cataloguePage.goto({ maxPriceShillings: 3450, sort: 'price-asc' });

    expect(
      await cataloguePage.totalMatches(),
      'a maximum of 3,450 must include the product priced at exactly 3,450',
    ).toBe(expected);
  });

  test('SK-CAT-026 one shilling above the maximum includes one more product', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ maxPriceShillings: 3449 });
    const below = await cataloguePage.totalMatches();

    await cataloguePage.goto({ maxPriceShillings: 3450 });
    const atBoundary = await cataloguePage.totalMatches();

    // Exactly one variant sits at 3,450, so raising the ceiling onto it adds one.
    expect(
      atBoundary,
      'raising the maximum onto a product price must bring that product into the set',
    ).toBe(below + 1);
  });

  test('SK-CAT-027 a min and max together bound the set on both sides', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ minPriceShillings: 1650, maxPriceShillings: 3450 });

    const expected = await testDb.product.count({
      where: {
        isActive: true,
        category: { slug: { in: SEED_CATEGORIES } },
        AND: [
          { variants: { some: { priceCents: { gte: 165_000 } } } },
          { variants: { some: { priceCents: { lte: 345_000 } } } },
        ],
      },
    });
    expect(await cataloguePage.totalMatches()).toBe(expected);
  });

  test('SK-CAT-028 an impossible range shows the empty state', async ({ cataloguePage }) => {
    await cataloguePage.goto({ minPriceShillings: 900_000, maxPriceShillings: 900_001 });

    await expect(cataloguePage.emptyState).toBeVisible();
    expect(await cataloguePage.totalMatches()).toBe(0);
  });

  test('SK-CAT-029 in-stock only excludes products with every variant at zero', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ inStockOnly: true, sort: 'name-asc' });
    const slugs = await cataloguePage.visibleSlugs();

    // Two seeded products have every variant at zero stock.
    expect(slugs).not.toContain('amazfit-bip-5-smartwatch');
    expect(slugs).not.toContain('von-hotpoint-microwave-oven-20l');

    const expected = await testDb.product.count({
      where: {
        isActive: true,
        category: { slug: { in: SEED_CATEGORIES } },
        variants: { some: { stockQty: { gt: 0 } } },
      },
    });
    expect(await cataloguePage.totalMatches()).toBe(expected);
  });

  test('SK-CAT-030 without the in-stock filter, sold-out products carry a badge', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ q: 'Amazfit' });

    await expect(cataloguePage.productCard('amazfit-bip-5-smartwatch')).toBeVisible();
    await expect(cataloguePage.outOfStockBadge('amazfit-bip-5-smartwatch')).toBeVisible();
  });

  test('SK-CAT-031 filters combine with search', async ({ cataloguePage }) => {
    await cataloguePage.goto({ q: 'a', categories: ['fashion'], inStockOnly: true });

    const slugs = await cataloguePage.visibleSlugs();
    for (const slug of slugs) {
      const product = await testDb.product.findUniqueOrThrow({
        where: { slug },
        include: { category: true, variants: true },
      });
      expect(product.category.slug).toBe('fashion');
      expect(product.variants.some((variant) => variant.stockQty > 0)).toBe(true);
    }
  });

  test('SK-CAT-032 filter state survives a reload', async ({ cataloguePage, page }) => {
    await cataloguePage.goto({
      categories: ['electronics'],
      minPriceShillings: 1000,
      maxPriceShillings: 20_000,
      inStockOnly: true,
      sort: 'price-asc',
    });
    const before = await cataloguePage.visibleSlugs();

    await page.reload();
    await cataloguePage.waitForResults();

    expect(await cataloguePage.visibleSlugs()).toEqual(before);
    await expect(cataloguePage.categoryCheckbox('electronics')).toBeChecked();
    await expect(cataloguePage.inStockCheckbox).toBeChecked();
    await expect(cataloguePage.minPriceInput).toHaveValue('1000');
    await expect(cataloguePage.maxPriceInput).toHaveValue('20000');
    await expect(cataloguePage.sortSelect).toHaveValue('price-asc');
  });

  test('SK-CAT-033 clearing filters restores the full catalogue', async ({ cataloguePage }) => {
    await cataloguePage.goto({ categories: ['fashion'], inStockOnly: true });
    await cataloguePage.clearFiltersButton.click();
    await cataloguePage.waitForResults();

    // The filtered results are still visible when the click returns, so this has to retry.
    await expect.poll(() => cataloguePage.totalMatches()).toBe(25);
    await expect(cataloguePage.categoryCheckbox('fashion')).not.toBeChecked();
  });
});
