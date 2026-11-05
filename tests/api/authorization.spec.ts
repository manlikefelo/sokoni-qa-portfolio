import { test, expect } from '@playwright/test';
import { USERS } from '../fixtures/users';
import { ProductPage } from '../pages/product.page';
import {
  testDb,
  createOrderFor,
  cleanupScopedOrders,
  createScopedProduct,
  cleanupScopedData,
  uniqueOrderNumber,
} from '../fixtures/db';

/**
 * Authorisation at the route level, independent of the UI, per PRD 7 and the test
 * spec's section 5.8.
 *
 * The point of testing this separately is that the navigation hides admin controls
 * from ordinary users, so a UI test can never tell the difference between "the server
 * refused" and "the button was not rendered". These requests go straight at the
 * routes.
 */
const ORDER_KEY_PREFIX = 'api-authz';

test.describe('SK-API: route-level authorisation', () => {
  test.afterAll(async () => {
    await cleanupScopedOrders(ORDER_KEY_PREFIX);
  });

  test('SK-API-020 an anonymous request to /admin gets 404, not 403', async ({ request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });

    // 404 rather than 403: a 403 would confirm the admin surface exists.
    expect(response.status()).toBe(404);
  });

  const adminRoutes = ['/admin', '/admin/products', '/admin/products/new', '/admin/orders'];

  for (const route of adminRoutes) {
    test(`SK-API-021 a customer is refused ${route}`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: USERS.customer.storageState });
      try {
        const response = await context.request.get(route, { maxRedirects: 0 });
        expect(response.status(), `a signed-in customer must not reach ${route}`).toBe(404);
      } finally {
        await context.close();
      }
    });
  }

  for (const route of adminRoutes) {
    test(`SK-API-022 an admin reaches ${route}`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: USERS.admin.storageState });
      try {
        const response = await context.request.get(route, { maxRedirects: 0 });
        expect(response.status(), `an admin should reach ${route}`).toBe(200);
      } finally {
        await context.close();
      }
    });
  }

  test('SK-API-023 anonymous access to the account area redirects to login', async ({
    request,
  }) => {
    const response = await request.get('/account', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toContain('/login');
  });

  test('SK-API-024 an unknown product slug returns 404', async ({ request }) => {
    const response = await request.get('/products/definitely-not-a-product');

    expect(response.status()).toBe(404);
  });

  /**
   * Uses a product created for this test rather than deactivating a seeded one.
   * Deactivating a shared product would change the catalogue under every other spec
   * running in parallel: the sort, filter and pagination assertions all count on the
   * seeded 25 being active.
   */
  test('SK-API-025 an inactive product is indistinguishable from a missing one', async ({
    request,
  }) => {
    const prefix = 'authz-inactive';
    await cleanupScopedData(prefix);

    const product = await createScopedProduct({
      prefix,
      name: 'Hidden Fixture Item',
      priceCents: 123_400,
      stockQty: 5,
    });

    try {
      // Visible while active.
      expect((await request.get(`/products/${product.slug}`)).status()).toBe(200);

      await testDb.product.update({ where: { id: product.id }, data: { isActive: false } });

      const response = await request.get(`/products/${product.slug}`);
      expect(response.status(), 'a deactivated product must 404 rather than render').toBe(404);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  /**
   * Ownership. Customer A requests customer B's order by its number and must get a
   * 404: the same answer an order that does not exist would give.
   */
  test('SK-API-026 a user cannot read another user’s order', async ({ browser }) => {
    const orderNumber = uniqueOrderNumber();
    await cleanupScopedOrders(`${ORDER_KEY_PREFIX}-owned`);
    await testDb.order.deleteMany({ where: { orderNumber } });

    await createOrderFor({
      email: USERS.secondCustomer.email,
      idempotencyKey: `${ORDER_KEY_PREFIX}-owned-${Date.now()}`,
      orderNumber,
    });

    const context = await browser.newContext({ storageState: USERS.customer.storageState });
    try {
      const response = await context.request.get(`/account/orders/${orderNumber}`, {
        maxRedirects: 0,
      });

      expect(response.status(), "requesting another user's order must return 404, not 403").toBe(
        404,
      );
    } finally {
      await context.close();
      await testDb.orderItem.deleteMany({ where: { order: { orderNumber } } });
      await testDb.order.deleteMany({ where: { orderNumber } });
    }
  });

  test('SK-API-027 a user can read their own order', async ({ browser }) => {
    const orderNumber = uniqueOrderNumber();
    await testDb.order.deleteMany({ where: { orderNumber } });

    await createOrderFor({
      email: USERS.customer.email,
      idempotencyKey: `${ORDER_KEY_PREFIX}-own-${Date.now()}`,
      orderNumber,
    });

    const context = await browser.newContext({ storageState: USERS.customer.storageState });
    try {
      const response = await context.request.get(`/account/orders/${orderNumber}`, {
        maxRedirects: 0,
      });

      expect(response.status()).toBe(200);
    } finally {
      await context.close();
      await testDb.orderItem.deleteMany({ where: { order: { orderNumber } } });
      await testDb.order.deleteMany({ where: { orderNumber } });
    }
  });

  test('SK-API-028 security headers are present on every response', async ({ request }) => {
    const response = await request.get('/products');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  test('SK-API-029 the framework version is not advertised', async ({ request }) => {
    const response = await request.get('/products');

    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  test('SK-API-030 the session cookie is HttpOnly and SameSite=Lax', async ({ browser }) => {
    const context = await browser.newContext({ storageState: USERS.customer.storageState });
    try {
      const cookies = await context.cookies();
      const session = cookies.find((cookie) => cookie.name.includes('sokoni.session'));

      expect(session, 'a session cookie should exist after signing in').toBeTruthy();
      expect(session?.httpOnly, 'the session cookie must not be readable from script').toBe(true);
      expect(session?.sameSite).toBe('Lax');
    } finally {
      await context.close();
    }
  });

  test('SK-API-031 the guest cart cookie is HttpOnly', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // Adding to the cart is what mints the guest token.
      const product = new ProductPage(page);
      await product.goto('leather-bifold-wallet');
      await product.addToCartAndWait();

      const cookies = await context.cookies();
      const guest = cookies.find((cookie) => cookie.name === 'sokoni.guest');

      expect(guest, 'a guest token should be issued when a cart is created').toBeTruthy();
      expect(guest?.httpOnly).toBe(true);
    } finally {
      await context.close();
    }
  });
});
