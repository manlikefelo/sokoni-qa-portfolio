import { test, expect } from '../fixtures/base';
import { createScopedProduct, cleanupScopedData } from '../fixtures/db';

/**
 * Visual baselines, per the test spec's section 5.10.
 *
 * Restricted to Chromium at two viewports. Font rasterisation differs between engines
 * and between platforms, so maintaining baselines per browser produces churn that
 * teaches nothing: a Firefox baseline failing because of sub-pixel antialiasing is
 * noise, and noise is how a suite loses its audience.
 *
 * Cart and checkout screenshots use a product this spec creates, because a screenshot
 * of the seeded catalogue would change every time anybody edited the seed. The
 * product images are generated SVGs rather than photographs, which is what makes these
 * baselines stable at all.
 */
test.describe('SK-VIS: visual baselines', () => {
  /**
   * Serialised with a fixed fixture prefix rather than a per-worker one. The fixture
   * product's name is rendered on screen, so a prefix carrying the worker index would
   * make the baseline depend on which worker happened to pick the test up.
   */
  test.describe.configure({ mode: 'serial' });

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'baselines are kept for Chromium only; cross-engine font rendering differences are noise',
  );

  const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    test(`SK-VIS-001 catalogue grid at ${viewport.name}`, async ({ page, cataloguePage }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await cataloguePage.goto({ sort: 'name-asc' });
      await expect(cataloguePage.grid).toBeVisible();

      await expect(page).toHaveScreenshot(`catalogue-${viewport.name}.png`, {
        fullPage: true,
        // Small rendering differences between runs are tolerated; a layout change is
        // not.
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });
    });

    test(`SK-VIS-002 product detail at ${viewport.name}`, async ({ page, productPage }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await productPage.goto('leather-bifold-wallet');
      await expect(productPage.name).toBeVisible();

      await expect(page).toHaveScreenshot(`product-detail-${viewport.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });
    });

    test(`SK-VIS-003 empty cart at ${viewport.name}`, async ({ page, cartPage }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await cartPage.goto();
      await expect(cartPage.emptyState).toBeVisible();

      await expect(page).toHaveScreenshot(`cart-empty-${viewport.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });
    });

    test(`SK-VIS-004 cart with items at ${viewport.name}`, async ({
      page,
      productPage,
      cartPage,
    }) => {
      const prefix = `vis-cart-${viewport.name}`;
      await cleanupScopedData(prefix);

      try {
        const product = await createScopedProduct({
          prefix,
          name: 'Visual Baseline Product',
          priceCents: 210_000,
          stockQty: 5,
          description: 'A product used to keep the cart screenshot stable across runs.',
        });

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await productPage.goto(product.slug);
        await productPage.setQuantity(2);
        await productPage.addToCartAndWait();
        await cartPage.goto();
        await expect(cartPage.subtotal).toHaveText('KSh 4,200.00');

        await expect(page).toHaveScreenshot(`cart-with-items-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
          // The variant id appears in the DOM but not on screen; the product image is
          // masked because its generated art is keyed off the scoped slug, which
          // carries the worker index and so differs between runs.
          mask: [cartPage.line(product.variants[0]?.id ?? '').locator('img')],
        });
      } finally {
        await cleanupScopedData(prefix);
      }
    });

    test(`SK-VIS-005 checkout review at ${viewport.name}`, async ({
      page,
      productPage,
      cartPage,
      checkoutPage,
    }) => {
      const prefix = `vis-review-${viewport.name}`;
      await cleanupScopedData(prefix);

      try {
        const product = await createScopedProduct({
          prefix,
          name: 'Visual Review Product',
          priceCents: 210_000,
          stockQty: 5,
          description: 'A product used to keep the checkout review screenshot stable.',
        });

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await productPage.goto(product.slug);
        await productPage.addToCartAndWait();
        await cartPage.goto();
        await cartPage.proceedToCheckout();

        await checkoutPage.fillAddress({
          email: 'visual.baseline@example.com',
          line1: 'Baseline House',
          line2: 'Floor 2',
          city: 'Nairobi',
          county: 'Nairobi',
          postalCode: '00100',
          phone: '0712345678',
        });
        await checkoutPage.submitAddress();
        await expect(checkoutPage.reviewItems).toBeVisible();

        await expect(page).toHaveScreenshot(`checkout-review-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
        });
      } finally {
        await cleanupScopedData(prefix);
      }
    });
  }
});
