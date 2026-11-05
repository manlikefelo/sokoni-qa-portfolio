import { test, expect } from '../../fixtures/base';

/**
 * Search, per PRD 4.1: by product name and description, case-insensitive, partial
 * match.
 *
 * The case variations are the point of this file. A single lowercase query passing
 * proves very little: it is the upper and mixed-case forms returning the *same*
 * result set that shows the matching is genuinely case-insensitive.
 */
test.describe('SK-CAT: catalogue search', () => {
  test('SK-CAT-001 an exact product name returns that product', async ({ cataloguePage }) => {
    await cataloguePage.goto({ q: 'Leather Bifold Wallet' });

    expect(await cataloguePage.totalMatches()).toBe(1);
    await expect(cataloguePage.productCard('leather-bifold-wallet')).toBeVisible();
  });

  test('SK-CAT-002 a partial name matches', async ({ cataloguePage }) => {
    await cataloguePage.goto({ q: 'Bifold' });

    expect(await cataloguePage.totalMatches()).toBe(1);
    await expect(cataloguePage.productCard('leather-bifold-wallet')).toBeVisible();
  });

  test('SK-CAT-003 search matches the description, not just the name', async ({
    cataloguePage,
  }) => {
    // "Kajiado" appears only in the Maasai sandals description.
    await cataloguePage.goto({ q: 'Kajiado' });

    expect(await cataloguePage.totalMatches()).toBe(1);
    await expect(cataloguePage.productCard('maasai-beaded-leather-sandals')).toBeVisible();
  });

  /**
   * Parametrised over case so a failure names the exact variation that broke. All
   * three must produce the same single result.
   */
  for (const term of ['wallet', 'WALLET', 'WaLLeT']) {
    test(`SK-CAT-004 search is case-insensitive for "${term}"`, async ({ cataloguePage }) => {
      await cataloguePage.goto({ q: term });

      expect(
        await cataloguePage.totalMatches(),
        `searching "${term}" should find the Leather Bifold Wallet`,
      ).toBe(1);
      await expect(cataloguePage.productCard('leather-bifold-wallet')).toBeVisible();
    });
  }

  test('SK-CAT-005 upper, lower and mixed case give identical result sets', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ q: 'shirt' });
    const lower = await cataloguePage.visibleSlugs();

    await cataloguePage.goto({ q: 'SHIRT' });
    const upper = await cataloguePage.visibleSlugs();

    await cataloguePage.goto({ q: 'Shirt' });
    const mixed = await cataloguePage.visibleSlugs();

    expect(lower.length, 'a search for "shirt" should match the T-Shirt product').toBeGreaterThan(
      0,
    );
    expect(upper).toEqual(lower);
    expect(mixed).toEqual(lower);
  });

  test('SK-CAT-006 a term that matches nothing shows the empty state', async ({
    cataloguePage,
  }) => {
    await cataloguePage.goto({ q: 'zzzzznotaproduct' });

    await expect(cataloguePage.emptyState).toBeVisible();
    expect(await cataloguePage.totalMatches()).toBe(0);
  });

  test('SK-CAT-007 special characters are handled without error', async ({ cataloguePage }) => {
    // A search term carrying SQL and regex metacharacters must be treated as text.
    await cataloguePage.goto({ q: "'; DROP TABLE products; --" });

    await expect(cataloguePage.emptyState).toBeVisible();

    // The catalogue must still be intact afterwards.
    await cataloguePage.goto();
    expect(await cataloguePage.totalMatches()).toBe(25);
  });

  test('SK-CAT-008 a percent sign is not treated as a wildcard', async ({ cataloguePage }) => {
    await cataloguePage.goto({ q: '%' });

    await expect(cataloguePage.emptyState).toBeVisible();
  });

  test('SK-CAT-009 the search term survives a reload', async ({ cataloguePage, page }) => {
    await cataloguePage.goto({ q: 'Wallet' });
    await page.reload();
    await cataloguePage.waitForResults();

    await expect(cataloguePage.searchInput).toHaveValue('Wallet');
    await expect(cataloguePage.productCard('leather-bifold-wallet')).toBeVisible();
  });

  test('SK-CAT-010 searching through the form updates the URL', async ({ cataloguePage, page }) => {
    await cataloguePage.goto();
    await cataloguePage.search('Wallet');

    expect(page.url()).toContain('q=Wallet');
    await expect(cataloguePage.productCard('leather-bifold-wallet')).toBeVisible();
  });
});
