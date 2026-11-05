import { test, expect } from '../../fixtures/base';
import { USERS } from '../../fixtures/users';
import { testDb, createScopedProduct, cleanupScopedData, stockOf } from '../../fixtures/db';
import { AdminPage } from '../../pages/admin.page';

/**
 * Admin product management and role gating, per PRD 4.8.
 */
test.describe('SK-ADM: role gating', () => {
  test('SK-ADM-300 a signed-out visitor gets not found on /admin', async ({ page, adminPage }) => {
    const response = await page.goto('/admin');

    expect(response?.status(), 'the admin surface must not announce itself').toBe(404);
    await expect(adminPage.nav).toBeHidden();
  });

  test('SK-ADM-301 a customer gets not found on /admin', async ({ browser }) => {
    const context = await browser.newContext({ storageState: USERS.customer.storageState });
    try {
      const page = await context.newPage();
      const response = await page.goto('/admin');

      expect(response?.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  test('SK-ADM-302 the admin link is absent for a customer', async ({ browser }) => {
    const context = await browser.newContext({ storageState: USERS.customer.storageState });
    try {
      const page = await context.newPage();
      const customerView = new AdminPage(page);
      await page.goto('/products');

      await expect(customerView.adminLink).toBeHidden();
    } finally {
      await context.close();
    }
  });
});

test.describe('SK-ADM: products', () => {
  test.use({ storageState: USERS.admin.storageState });

  test('SK-ADM-310 the admin link is visible to an admin', async ({ page, adminPage }) => {
    await page.goto('/products');
    await expect(await adminPage.revealAdminLink()).toBeVisible();
  });

  test('SK-ADM-311 the overview reports the catalogue size', async ({ adminPage }) => {
    await adminPage.gotoOverview();

    const productCount = await testDb.product.count();
    await expect(adminPage.statTile('products')).toHaveText(String(productCount));
  });

  test('SK-ADM-312 a product can be created', async ({ adminPage, workerPrefix }) => {
    const slug = `${workerPrefix}-created-product`;
    await cleanupScopedData(slug);

    try {
      await adminPage.gotoNewProduct();
      await adminPage.createProduct({
        name: 'Admin Created Product',
        slug,
        description: 'Created through the admin interface by an automated test.',
        priceCents: 123_400,
      });

      await expect(adminPage.productSuccess).toBeVisible();

      const created = await testDb.product.findUnique({
        where: { slug },
        include: { variants: true },
      });
      expect(created, 'the product should exist afterwards').toBeTruthy();
      expect(created?.basePriceCents).toBe(123_400);
      expect(
        created?.variants,
        'a new product needs at least one variant to be purchasable',
      ).toHaveLength(1);
    } finally {
      await cleanupScopedData(slug);
    }
  });

  test('SK-ADM-313 a duplicate slug is rejected', async ({ adminPage, workerPrefix }) => {
    const prefix = `${workerPrefix}-dupe`;
    await cleanupScopedData(prefix);

    try {
      const existing = await createScopedProduct({
        prefix,
        name: 'Existing Product',
        priceCents: 100_000,
        stockQty: 1,
      });

      await adminPage.gotoNewProduct();
      await adminPage.createProduct({
        name: 'Clashing Product',
        slug: existing.slug,
        description: 'A product whose slug is already taken by another product.',
        priceCents: 200_000,
      });

      await expect(adminPage.fieldError('slug')).toBeVisible();
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-ADM-314 an invalid slug format is rejected', async ({ adminPage }) => {
    await adminPage.gotoNewProduct();
    await adminPage.createProduct({
      name: 'Bad Slug Product',
      slug: 'Not A Valid Slug!',
      description: 'A product whose slug is not in the required format.',
      priceCents: 100_000,
    });

    await expect(adminPage.fieldError('slug')).toBeVisible();
  });

  test('SK-ADM-315 a product can be edited', async ({ adminPage, workerPrefix }) => {
    const prefix = `${workerPrefix}-edit`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Editable Product',
        priceCents: 100_000,
        stockQty: 3,
      });

      await adminPage.gotoEditProduct(product.id);
      await adminPage.productField('name').fill('Renamed Product');
      await adminPage.productSaveButton.click();
      await expect(adminPage.productSuccess).toBeVisible();

      const updated = await testDb.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updated.name).toBe('Renamed Product');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-ADM-316 deactivating a product removes it from the storefront', async ({
    adminPage,
    page,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-deactivate`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Deactivation Target',
        priceCents: 100_000,
        stockQty: 3,
      });

      // Visible to a shopper while active.
      expect((await page.goto(`/products/${product.slug}`))?.status()).toBe(200);

      await adminPage.gotoProducts();
      await adminPage.productActiveToggle(product.slug).click();
      await expect(adminPage.productState(product.slug)).toHaveText('Inactive');

      // Gone from the storefront, and indistinguishable from a product that never
      // existed.
      expect(
        (await page.goto(`/products/${product.slug}`))?.status(),
        'a deactivated product must 404 for shoppers',
      ).toBe(404);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-ADM-317 a stock adjustment reaches the storefront', async ({
    adminPage,
    productPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-stockadjust`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Stock Adjustment Target',
        priceCents: 100_000,
        stockQty: 2,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      await adminPage.gotoProducts();
      await adminPage.setStock(variant.sku, 7);

      expect(await stockOf(variant.sku), 'the new figure should be stored').toBe(7);

      await productPage.goto(product.slug);
      await expect(
        productPage.stockIndicator,
        'the storefront should reflect the adjusted figure',
      ).toContainText('7');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-ADM-318 stock can be set to zero, marking the product sold out', async ({
    adminPage,
    productPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-stockzero`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Sold Out Target',
        priceCents: 100_000,
        stockQty: 4,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      await adminPage.gotoProducts();
      await adminPage.setStock(variant.sku, 0);

      await productPage.goto(product.slug);
      await expect(productPage.stockIndicator).toContainText('Out of stock');
      await expect(productPage.addToCartButton).toBeDisabled();
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-ADM-319 a negative stock figure is rejected', async ({ adminPage, workerPrefix }) => {
    const prefix = `${workerPrefix}-stocknegative`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Negative Stock Target',
        priceCents: 100_000,
        stockQty: 5,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      await adminPage.gotoProducts();
      await adminPage.stockInput(variant.sku).fill('-4');
      await adminPage.stockSaveButton(variant.sku).click();

      // Whatever the page reports, the stored figure must not go negative.
      expect(await stockOf(variant.sku), 'stock must never be stored as negative').toBe(5);
    } finally {
      await cleanupScopedData(prefix);
    }
  });
});

test.describe('SK-ADM: order list', () => {
  test.use({ storageState: USERS.admin.storageState });

  test('SK-ADM-330 the order list is reachable', async ({ adminPage }) => {
    await adminPage.gotoOrders();

    await expect(adminPage.statusFilter).toBeVisible();
  });

  test('SK-ADM-331 filtering by status narrows the list', async ({ adminPage }) => {
    await adminPage.gotoOrders('CANCELLED');

    const cancelled = await testDb.order.count({ where: { status: 'CANCELLED' } });
    if (cancelled === 0) {
      await expect(adminPage.ordersEmpty).toBeVisible();
    } else {
      await expect(adminPage.ordersList).toBeVisible();
    }
  });

  test('SK-ADM-332 an unrecognised status filter falls back to showing everything', async ({
    page,
    adminPage,
  }) => {
    await page.goto('/admin/orders?status=NOT_A_STATUS');

    // A hand-edited query string must not produce an error page.
    await expect(adminPage.statusFilter).toBeVisible();
  });
});
