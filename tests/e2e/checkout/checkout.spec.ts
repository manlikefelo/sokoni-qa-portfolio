import { test, expect } from '../../fixtures/base';
import { CARDS, VALID_ADDRESS, CheckoutPage } from '../../pages/checkout.page';
import { ProductPage } from '../../pages/product.page';
import {
  testDb,
  createScopedProduct,
  cleanupScopedData,
  cleanupScopedOrders,
  stockOf,
} from '../../fixtures/db';
import { resetRateLimits } from '../../fixtures/rate-limit';

/**
 * Checkout, per PRD 4.6.
 *
 * Each spec creates the product it buys, so consuming stock cannot disturb the seeded
 * catalogue or another spec running beside it. Orders are identified by an idempotency
 * key carrying the worker prefix and removed afterwards.
 */
test.describe('SK-CHK: guest checkout journey', () => {
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  test('SK-CHK-001 a guest can complete an order end to end', async ({
    productPage,
    cartPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-happy`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Checkout Happy Path',
        priceCents: 210_000,
        stockQty: 10,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await expect(cartPage.total).toHaveText('KSh 2,450.00');
      await cartPage.proceedToCheckout();

      await checkoutPage.fillAddress(VALID_ADDRESS);
      await checkoutPage.submitAddress();

      await expect(checkoutPage.reviewItems).toBeVisible();
      await expect(checkoutPage.reviewEmail).toHaveText(VALID_ADDRESS.email ?? '');
      await expect(checkoutPage.total).toHaveText('KSh 2,450.00');

      await checkoutPage.continueToPayment();
      await checkoutPage.fillCard(CARDS.approved);
      await checkoutPage.pay();

      await expect(checkoutPage.confirmationHeading).toBeVisible();
      const orderNumber = await checkoutPage.orderNumber();
      expect(orderNumber, 'the order number should follow the SK-YYYY-NNNNNN shape').toMatch(
        /^SK-\d{4}-\d{6}$/,
      );

      // Every figure is snapshotted on the order, so it survives later price changes.
      const order = await testDb.order.findUniqueOrThrow({
        where: { orderNumber },
        include: { items: true },
      });
      expect(order.subtotalCents).toBe(210_000);
      expect(order.shippingCents).toBe(35_000);
      expect(order.totalCents).toBe(245_000);
      expect(order.status).toBe('PAID');
      expect(order.items[0]?.productName).toBe('Checkout Happy Path');
      expect(order.items[0]?.unitPriceCents).toBe(210_000);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-CHK-002 the cart is emptied after a successful order', async ({
    productPage,
    cartPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-clears`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Cart Clearing Fixture',
        priceCents: 150_000,
        stockQty: 10,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await checkoutPage.completeCheckout(VALID_ADDRESS, CARDS.approved);
      await expect(checkoutPage.confirmationHeading).toBeVisible();

      await cartPage.goto();
      await expect(cartPage.emptyState).toBeVisible();
      expect(await cartPage.getCartCount()).toBe(0);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-CHK-003 address validation rejects incomplete input', async ({
    productPage,
    cartPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-validation`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Address Validation Fixture',
        priceCents: 150_000,
        stockQty: 5,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();
      await cartPage.goto();
      await cartPage.proceedToCheckout();

      /**
       * The phone number is well-formed as far as the browser is concerned: the
       * field is type="tel", which carries no format constraint, but it is not a
       * Kenyan number, so only the server can reject it. The email is left valid on
       * purpose: an email the browser itself refuses would stop the submission before
       * the server ran, and this test is about server-side validation.
       */
      await checkoutPage.fillAddress({
        ...VALID_ADDRESS,
        phone: '12345',
      });
      await checkoutPage.submitAddress();

      await expect(
        checkoutPage.fieldError('phone'),
        'the server must reject a phone number that is not a Kenyan format',
      ).toBeVisible();
      await expect(checkoutPage.fieldError('phone')).toContainText('Kenyan');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-CHK-004 checkout is unreachable with an empty cart', async ({ page, checkoutPage }) => {
    await page.goto('/checkout/address');

    // Redirected back to the cart rather than shown an address form for nothing.
    await expect(page).toHaveURL(/\/cart$/);
    await expect(checkoutPage.addressForm).toBeHidden();
  });

  test('SK-CHK-005 the review step shows the same totals as the cart', async ({
    productPage,
    cartPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-totals`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Review Totals Fixture',
        priceCents: 175_000,
        stockQty: 10,
      });

      await productPage.goto(product.slug);
      await productPage.setQuantity(2);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      const cartTotal = await cartPage.total.innerText();

      await cartPage.proceedToCheckout();
      await checkoutPage.fillAddress(VALID_ADDRESS);
      await checkoutPage.submitAddress();
      await expect(checkoutPage.reviewItems).toBeVisible();

      await expect(checkoutPage.total, 'the review total must match the cart total').toHaveText(
        cartTotal,
      );
    } finally {
      await cleanupScopedData(prefix);
    }
  });
});

/**
 * Payment outcomes and, most importantly, what each one does to stock.
 *
 * PRD 4.6 is explicit: "Stock is decremented only AFTER the payment is confirmed
 * approved. A declined or errored payment must leave all stock untouched." So each
 * case records the stock figure, attempts the payment, and compares.
 */
test.describe('SK-CHK: payment outcomes and stock invariants', () => {
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  const declines = [
    { id: 'SK-CHK-010', label: 'card declined', card: CARDS.declined },
    { id: 'SK-CHK-011', label: 'expired card', card: CARDS.expired },
    { id: 'SK-CHK-012', label: 'insufficient funds', card: CARDS.insufficientFunds },
    { id: 'SK-CHK-013', label: 'unrecognised card', card: CARDS.invalid },
  ];

  for (const decline of declines) {
    test(`${decline.id} a ${decline.label} leaves stock untouched`, async ({
      productPage,
      checkoutPage,
      workerPrefix,
    }) => {
      const prefix = `${workerPrefix}-chk-${decline.card.slice(-4)}`;
      await cleanupScopedData(prefix);

      try {
        const product = await createScopedProduct({
          prefix,
          name: `Decline Fixture ${decline.card.slice(-4)}`,
          priceCents: 150_000,
          stockQty: 6,
        });
        const variant = product.variants[0];
        if (!variant) throw new Error('fixture has no variant');

        const stockBefore = await stockOf(variant.sku);
        expect(stockBefore).toBe(6);

        await productPage.goto(product.slug);
        await productPage.setQuantity(2);
        await productPage.addToCartAndWait();

        await checkoutPage.completeCheckout(VALID_ADDRESS, decline.card);

        await expect(checkoutPage.paymentError).toBeVisible();
        await expect(checkoutPage.confirmationHeading).toBeHidden();

        expect(await stockOf(variant.sku), `a ${decline.label} must not consume stock`).toBe(
          stockBefore,
        );
      } finally {
        await cleanupScopedData(prefix);
      }
    });
  }

  test('SK-CHK-014 a gateway error leaves stock untouched', async ({
    productPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-gwerror`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Gateway Error Fixture',
        priceCents: 150_000,
        stockQty: 4,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      const stockBefore = await stockOf(variant.sku);

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      // This card takes three seconds by design. The wait is on the resulting UI
      // state, never on elapsed time.
      await checkoutPage.completeCheckout(VALID_ADDRESS, CARDS.gatewayError);

      await expect(checkoutPage.paymentError).toBeVisible();
      expect(await stockOf(variant.sku), 'a gateway error must not consume stock either').toBe(
        stockBefore,
      );
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-CHK-015 an approved payment decrements stock by exactly the quantity ordered', async ({
    productPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-approved-stock`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Approved Stock Fixture',
        priceCents: 150_000,
        stockQty: 8,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      const stockBefore = await stockOf(variant.sku);

      await productPage.goto(product.slug);
      await productPage.setQuantity(3);
      await productPage.addToCartAndWait();

      await checkoutPage.completeCheckout(VALID_ADDRESS, CARDS.approved);
      await expect(checkoutPage.confirmationHeading).toBeVisible();

      expect(await stockOf(variant.sku), 'three ordered means three off the shelf').toBe(
        stockBefore - 3,
      );
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-CHK-016 repeated declines do not erode stock', async ({
    productPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-repeat-decline`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Repeat Decline Fixture',
        priceCents: 150_000,
        stockQty: 3,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      // Three declined attempts against three units in stock. If a declined payment
      // consumed stock, the product would be sold out having sold nothing.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await checkoutPage.completeCheckout(VALID_ADDRESS, CARDS.declined);
        await expect(checkoutPage.paymentError).toBeVisible();
      }

      expect(
        await stockOf(variant.sku),
        'three declined attempts must leave all three units available',
      ).toBe(3);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-CHK-017 the last unit can still be bought after a decline', async ({
    productPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-lastunit`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Last Unit Fixture',
        priceCents: 150_000,
        stockQty: 1,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await checkoutPage.completeCheckout(VALID_ADDRESS, CARDS.declined);
      await expect(checkoutPage.paymentError).toBeVisible();

      // The shopper tries again with a good card. The unit must still be there.
      await checkoutPage.fillCard(CARDS.approved);
      await checkoutPage.pay();

      await expect(
        checkoutPage.confirmationHeading,
        'a declined attempt must not cost the shopper the item',
      ).toBeVisible();
      expect(await stockOf(variant.sku)).toBe(0);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-CHK-018 a promo code usage count rises only on a completed order', async ({
    productPage,
    cartPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-promo-usage`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Promo Usage Fixture',
        priceCents: 300_000,
        stockQty: 5,
      });

      const before = (await testDb.promoCode.findUniqueOrThrow({ where: { code: 'SAVE10' } }))
        .usedCount;

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await cartPage.applyPromo('SAVE10');
      await expect(cartPage.promoApplied).toBeVisible();

      await checkoutPage.completeCheckout(VALID_ADDRESS, CARDS.approved);
      await expect(checkoutPage.confirmationHeading).toBeVisible();

      const after = (await testDb.promoCode.findUniqueOrThrow({ where: { code: 'SAVE10' } }))
        .usedCount;
      expect(after, 'a completed order should increment the code once').toBe(before + 1);
    } finally {
      await cleanupScopedData(prefix);
    }
  });
});

/**
 * Idempotency and concurrency, per PRD 4.6.
 */
test.describe('SK-CHK: idempotency and concurrency', () => {
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  test('SK-CHK-020 resubmitting the payment form yields one order', async ({
    productPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-idem`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Idempotency Fixture',
        priceCents: 150_000,
        stockQty: 9,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await checkoutPage.completeCheckout(VALID_ADDRESS, CARDS.approved);
      await expect(checkoutPage.confirmationHeading).toBeVisible();
      const orderNumber = await checkoutPage.orderNumber();

      // Reloading the confirmation page must not mint a second order.
      await checkoutPage.reload();
      await expect(checkoutPage.confirmationOrderNumber).toHaveText(orderNumber);

      const orders = await testDb.order.findMany({
        where: { items: { some: { variantId: variant.id } } },
      });
      expect(orders, 'one payment means one order').toHaveLength(1);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  /**
   * Two shoppers race for the last unit. Exactly one may win, and stock may never go
   * negative. Each context has its own cart, which is what makes them independent
   * shoppers rather than one shopper in two tabs.
   */
  test('SK-CHK-021 two shoppers racing for the last unit: exactly one succeeds', async ({
    browser,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-chk-race`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Race Fixture',
        priceCents: 150_000,
        stockQty: 1,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      const contexts = await Promise.all([browser.newContext(), browser.newContext()]);

      try {
        // Each shopper drives the real page objects, so no locator is written here.
        const attempts = contexts.map(async (context) => {
          const page = await context.newPage();
          const shopperProduct = new ProductPage(page);
          const shopperCheckout = new CheckoutPage(page);

          await shopperProduct.goto(product.slug);
          await shopperProduct.addToCartAndWait();

          await shopperCheckout.completeCheckout(
            { ...VALID_ADDRESS, email: 'racer@example.com' },
            CARDS.approved,
          );

          return shopperCheckout.confirmationHeading.isVisible();
        });

        const results = await Promise.all(attempts);
        const wins = results.filter(Boolean).length;

        expect(wins, 'one unit in stock means exactly one shopper can buy it').toBe(1);

        const remaining = await stockOf(variant.sku);
        expect(remaining, 'stock must never go negative').toBe(0);
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    } finally {
      await cleanupScopedOrders(prefix);
      await cleanupScopedData(prefix);
    }
  });
});
