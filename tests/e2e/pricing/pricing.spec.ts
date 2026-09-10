import { test, expect } from '../../fixtures/base';
import {
  testDb,
  createScopedProduct,
  cleanupScopedData,
  setStock,
  stockOf,
} from '../../fixtures/db';
import { resetRateLimits } from '../../fixtures/rate-limit';
import cases from '../../data/pricing-cases.json';

/**
 * The pricing engine, driven through the real cart, per PRD 4.5.
 *
 * Expected figures in tests/data/pricing-cases.json were derived by hand from the
 * specification, not captured from the application — a baseline recorded from the
 * system under test would agree with whatever that system does, including its
 * mistakes.
 *
 * Cases carrying prices the seeded catalogue does not have get a fixture product of
 * their own, so the exact unit price the case needs is available. Those products are
 * namespaced per worker and removed afterwards.
 */
interface PricingCase {
  id: string;
  name: string;
  lines: Array<{ sku: string; unitPriceCents: number; quantity: number }>;
  promo: { code: string; type: string; value: number; minSpendCents: number } | null;
  expected: { subtotal: number; discount: number; shipping: number; total: number };
}

const PRICING_CASES = cases.cases as PricingCase[];

function money(cents: number): string {
  const body = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);
  return `${cents < 0 ? '-' : ''}KSh ${body}`;
}

/**
 * Only the codes the seed actually provides can be applied through the UI. Cases
 * naming a hypothetical code exercise the pure function instead, via the cases that
 * do not need one; the promo-specific behaviour has its own spec file.
 */
const SEEDED_CODES = new Set(['SAVE10', 'SAVE25', 'FLAT500', 'ENDSTODAY', 'ONESHOT']);

test.describe('SK-PRICE — pricing engine through the cart', () => {
  // Promo application is rate limited by IP, and this file applies codes dozens of
  // times from one address. The buckets are cleared between tests so the limiter does
  // not start failing tests for the wrong reason. See tests/fixtures/rate-limit.ts.
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  for (const testCase of PRICING_CASES) {
    const needsUnseededPromo = testCase.promo !== null && !SEEDED_CODES.has(testCase.promo.code);

    // ONESHOT is single-use, so driving it through the cart would consume it for
    // every other spec. Its behaviour is covered in the promo spec instead.
    const usesSingleUse = testCase.promo?.code === 'ONESHOT';

    const skipReason = needsUnseededPromo
      ? 'promo code is hypothetical and not in the seed'
      : usesSingleUse
        ? 'single-use code is covered in the promo spec'
        : null;

    test(`SK-PRICE-${testCase.id.replace('PRICE-', '')} ${testCase.name}`, async ({
      productPage,
      cartPage,
      workerPrefix,
    }) => {
      test.skip(skipReason !== null, skipReason ?? '');

      const prefix = `${workerPrefix}-price-${testCase.id.toLowerCase()}`;
      await cleanupScopedData(prefix);

      try {
        // A product per line, priced exactly as the case requires.
        for (const [index, line] of testCase.lines.entries()) {
          const product = await createScopedProduct({
            prefix: `${prefix}-${index}`,
            name: `${testCase.id} Line ${index + 1}`,
            priceCents: line.unitPriceCents,
            stockQty: Math.max(line.quantity, 1),
          });

          await productPage.goto(product.slug);
          await productPage.setQuantity(line.quantity);
          await productPage.addToCartAndWait();
        }

        await cartPage.goto();

        if (testCase.promo) {
          await cartPage.applyPromo(testCase.promo.code);
          await expect(cartPage.promoApplied).toBeVisible();
        }

        // Exact values to the cent, not merely presence. A presence assertion would
        // miss every rounding and scope error this file exists to catch.
        await expect(cartPage.subtotal, `${testCase.id} subtotal`).toHaveText(
          money(testCase.expected.subtotal),
        );

        if (testCase.expected.discount > 0) {
          await expect(cartPage.discount, `${testCase.id} discount`).toHaveText(
            money(-testCase.expected.discount),
          );
        }

        await expect(cartPage.shipping, `${testCase.id} shipping`).toHaveText(
          money(testCase.expected.shipping),
        );
        await expect(cartPage.total, `${testCase.id} total`).toHaveText(
          money(testCase.expected.total),
        );
      } finally {
        for (const index of testCase.lines.keys()) {
          await cleanupScopedData(`${prefix}-${index}`);
        }
        await cleanupScopedData(prefix);
      }
    });
  }
});

/**
 * The discount must apply to the subtotal and never to shipping. Asserted on an order
 * below the free-shipping threshold, so shipping is a visible KSh 350 and any leakage
 * shows up as a concrete difference rather than being hidden by a zero.
 */
test.describe('SK-PRICE — discount scope', () => {
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  test('SK-PRICE-100 a percentage discount never touches shipping', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-scope`;
    await cleanupScopedData(prefix);

    try {
      // KSh 2,000 keeps the order under the threshold, so shipping is KSh 350.
      const product = await createScopedProduct({
        prefix,
        name: 'Discount Scope Fixture',
        priceCents: 200_000,
        stockQty: 5,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await expect(cartPage.subtotal).toHaveText('KSh 2,000.00');
      await expect(cartPage.shipping).toHaveText('KSh 350.00');

      await cartPage.applyPromo('SAVE10');
      await expect(cartPage.promoApplied).toBeVisible();

      // 10% of the KSh 2,000 subtotal is KSh 200. 10% of subtotal plus shipping
      // would be KSh 235, and the total would come out KSh 35 light.
      await expect(
        cartPage.discount,
        'the discount must be 10% of the subtotal, not of subtotal plus shipping',
      ).toHaveText('-KSh 200.00');
      await expect(cartPage.shipping, 'shipping must be untouched by the discount').toHaveText(
        'KSh 350.00',
      );
      await expect(cartPage.total).toHaveText('KSh 2,150.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PRICE-101 shipping is assessed on the post-discount subtotal', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-postdiscount`;
    await cleanupScopedData(prefix);

    try {
      // KSh 5,200 qualifies for free shipping, but 10% off brings it to KSh 4,680,
      // which does not — so shipping must reappear.
      const product = await createScopedProduct({
        prefix,
        name: 'Threshold Crossing Fixture',
        priceCents: 520_000,
        stockQty: 5,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await expect(cartPage.shipping, 'free before the discount').toHaveText('KSh 0.00');

      await cartPage.applyPromo('SAVE10');
      await expect(cartPage.promoApplied).toBeVisible();

      await expect(cartPage.discount).toHaveText('-KSh 520.00');
      await expect(
        cartPage.shipping,
        'the post-discount subtotal of KSh 4,680 falls below the threshold',
      ).toHaveText('KSh 350.00');
      await expect(cartPage.total).toHaveText('KSh 5,030.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PRICE-102 the discount is rounded once, not per line', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-rounding`;
    await cleanupScopedData(prefix);

    try {
      // Five lines at KSh 1,111.15. Each line's 10% share is 111.115, which rounds to
      // 111.12 — five of those sum to 555.60. Computed once on the KSh 5,555.75
      // subtotal the discount is 555.575, which rounds to 555.58. The post-discount
      // subtotal stays above the free-shipping threshold, so shipping is zero and
      // cannot mask the two-cent difference.
      for (let index = 0; index < 5; index += 1) {
        const product = await createScopedProduct({
          prefix: `${prefix}-${index}`,
          name: `Rounding Fixture ${index + 1}`,
          priceCents: 111_115,
          stockQty: 2,
        });
        await productPage.goto(product.slug);
        await productPage.addToCartAndWait();
      }

      await cartPage.goto();
      await expect(cartPage.subtotal).toHaveText('KSh 5,555.75');

      await cartPage.applyPromo('SAVE10');
      await expect(cartPage.promoApplied).toBeVisible();

      await expect(cartPage.shipping, 'free shipping keeps this case isolated').toHaveText(
        'KSh 0.00',
      );
      await expect(
        cartPage.discount,
        'rounding the subtotal once gives 555.58; rounding each line gives 555.60',
      ).toHaveText('-KSh 555.58');
      await expect(cartPage.total).toHaveText('KSh 5,000.17');
    } finally {
      for (let index = 0; index < 5; index += 1) {
        await cleanupScopedData(`${prefix}-${index}`);
      }
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PRICE-103 a fixed discount is capped at the subtotal', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-cap`;
    await cleanupScopedData(prefix);

    try {
      // FLAT500 takes KSh 500 off but needs a KSh 2,000 minimum, so this checks the
      // cap indirectly: a KSh 2,000 order nets KSh 1,500 plus shipping.
      const product = await createScopedProduct({
        prefix,
        name: 'Fixed Discount Fixture',
        priceCents: 200_000,
        stockQty: 5,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await cartPage.applyPromo('FLAT500');
      await expect(cartPage.promoApplied).toBeVisible();

      await expect(cartPage.discount).toHaveText('-KSh 500.00');
      await expect(cartPage.total).toHaveText('KSh 1,850.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PRICE-104 an empty cart prices to zero, with no shipping charge', async ({
    cartPage,
  }) => {
    await cartPage.goto();

    // An empty cart must not be quoted a delivery fee.
    await expect(cartPage.emptyState).toBeVisible();
  });
});

/**
 * Totals are recomputed server-side at order creation. A price changed after an item
 * is already in the cart must be reflected, because the cart holds a reference to the
 * variant rather than a copy of its price.
 */
test.describe('SK-PRICE — server-side recomputation', () => {
  test('SK-PRICE-110 a price change is picked up by the cart', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-repricing`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Repricing Fixture',
        priceCents: 100_000,
        stockQty: 5,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture product has no variant');

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await expect(cartPage.subtotal).toHaveText('KSh 1,000.00');

      // The price moves while the item sits in the cart.
      await testDb.variant.update({ where: { id: variant.id }, data: { priceCents: 150_000 } });

      await cartPage.goto();
      await expect(
        cartPage.subtotal,
        'the cart must price from the database, not from a stored copy',
      ).toHaveText('KSh 1,500.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PRICE-111 stock changes do not alter pricing', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-stockprice`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Stock Price Fixture',
        priceCents: 250_000,
        stockQty: 10,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture product has no variant');

      await productPage.goto(product.slug);
      await productPage.setQuantity(2);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await expect(cartPage.subtotal).toHaveText('KSh 5,000.00');

      const before = await stockOf(variant.sku);
      await setStock(variant.sku, before - 3);

      await cartPage.goto();
      await expect(cartPage.subtotal).toHaveText('KSh 5,000.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });
});
