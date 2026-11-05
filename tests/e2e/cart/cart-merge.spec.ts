import { test, expect } from '../../fixtures/base';
import { USERS } from '../../fixtures/users';
import { clearUserCart, seedUserCart, variantBySku, setStock, stockOf } from '../../fixtures/db';
import { resetRateLimits } from '../../fixtures/rate-limit';

/**
 * Cart merge on login, per PRD 4.3:
 *
 *   "On login, the guest cart must MERGE into the user's existing cart. For a variant
 *    present in both, quantities are summed and then capped at available stock.
 *    Neither cart may be discarded."
 *
 * The scenario the test spec asks for: guest holds A and B, user holds B and C; after
 * login all three survive, with B summed.
 *
 * These specs sign in through the form rather than using a saved storageState,
 * because the merge is a side effect of signing in and would not happen if the
 * session were injected. They run serially and reset the user's cart around each
 * test, since they all operate on the same account.
 */
const A = 'FASH-WALL-BRN'; // guest only
const B = 'FASH-CREW-L-WHT'; // in both carts
const C = 'HOME-NX18-STL'; // user only

test.describe('SK-CART: merge on login', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * Every spec here signs in through the form, and SK-CART-045 signs in twice. Under
   * --repeat-each that is enough attempts to trip the ten-per-fifteen-minutes login
   * limiter, so the buckets are cleared before each test. The limiter stays at
   * production strength and is tested at its boundary by SK-ACC-030.
   */
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
    await clearUserCart(USERS.customer.email);
  });

  test.afterAll(async () => {
    await clearUserCart(USERS.customer.email);
  });

  test('SK-CART-040 all three variants survive the merge', async ({
    productPage,
    loginPage,
    cartPage,
  }) => {
    // The user already has B and C saved from an earlier session.
    await seedUserCart(USERS.customer.email, [
      { sku: B, quantity: 2 },
      { sku: C, quantity: 1 },
    ]);

    // As a guest, add A and B.
    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant(A);
    await productPage.addToCartAndWait();

    await productPage.goto('premium-cotton-crew-t-shirt');
    await productPage.selectVariant(B);
    await productPage.setQuantity(3);
    await productPage.addToCartAndWait();

    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await cartPage.goto();

    const [variantA, variantB, variantC] = await Promise.all([
      variantBySku(A),
      variantBySku(B),
      variantBySku(C),
    ]);

    await expect(cartPage.line(variantA.id), 'the guest-only item must survive').toBeVisible();
    await expect(cartPage.line(variantB.id), 'the shared item must survive').toBeVisible();
    await expect(
      cartPage.line(variantC.id),
      "the user's previously saved item must not be discarded",
    ).toBeVisible();

    expect(await cartPage.lineCount()).toBe(3);
  });

  test('SK-CART-041 quantities for a shared variant are summed', async ({
    productPage,
    loginPage,
    cartPage,
  }) => {
    await seedUserCart(USERS.customer.email, [{ sku: B, quantity: 2 }]);

    await productPage.goto('premium-cotton-crew-t-shirt');
    await productPage.selectVariant(B);
    await productPage.setQuantity(3);
    await productPage.addToCartAndWait();

    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await cartPage.goto();
    const variantB = await variantBySku(B);

    // 2 saved plus 3 from the guest session is 5, and stock is well above that.
    await expect(cartPage.quantityInput(variantB.id)).toHaveValue('5');
  });

  test('SK-CART-042 the summed quantity is capped at available stock', async ({
    productPage,
    loginPage,
    cartPage,
  }) => {
    const original = await stockOf(B);
    try {
      // Stock of 4 against a combined 6 forces the cap to do something.
      await setStock(B, 4);
      await seedUserCart(USERS.customer.email, [{ sku: B, quantity: 3 }]);

      await productPage.goto('premium-cotton-crew-t-shirt');
      await productPage.selectVariant(B);
      await productPage.setQuantity(3);
      await productPage.addToCartAndWait();

      await loginPage.goto();
      await loginPage.signIn(USERS.customer.email, USERS.customer.password);
      await loginPage.waitForUrl(/\/account$/);

      await cartPage.goto();
      const variantB = await variantBySku(B);

      await expect(
        cartPage.quantityInput(variantB.id),
        'a combined quantity of 6 against stock of 4 must cap at 4',
      ).toHaveValue('4');
    } finally {
      await setStock(B, original);
    }
  });

  test('SK-CART-043 an empty guest cart leaves the user cart untouched', async ({
    loginPage,
    cartPage,
  }) => {
    await seedUserCart(USERS.customer.email, [
      { sku: B, quantity: 2 },
      { sku: C, quantity: 1 },
    ]);

    // Sign in with no guest cart at all.
    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await cartPage.goto();
    expect(await cartPage.lineCount()).toBe(2);
  });

  test('SK-CART-044 an empty user cart receives the whole guest cart', async ({
    productPage,
    loginPage,
    cartPage,
  }) => {
    // User cart is empty, courtesy of beforeEach.
    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant(A);
    await productPage.setQuantity(2);
    await productPage.addToCartAndWait();

    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await cartPage.goto();
    const variantA = await variantBySku(A);
    await expect(cartPage.quantityInput(variantA.id)).toHaveValue('2');
  });

  test('SK-CART-045 the merged cart persists after signing out and back in', async ({
    productPage,
    loginPage,
    cartPage,
  }) => {
    await seedUserCart(USERS.customer.email, [{ sku: C, quantity: 1 }]);

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant(A);
    await productPage.addToCartAndWait();

    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await cartPage.goto();
    expect(await cartPage.lineCount()).toBe(2);

    await cartPage.logout();
    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await cartPage.goto();
    expect(
      await cartPage.lineCount(),
      'the merged cart belongs to the account and must still be there',
    ).toBe(2);
  });
});
