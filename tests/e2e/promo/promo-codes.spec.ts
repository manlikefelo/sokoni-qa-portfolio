import { test, expect } from '../../fixtures/base';
import {
  createScopedProduct,
  cleanupScopedData,
  promoByCode,
  resetPromoUsage,
  testDb,
} from '../../fixtures/db';
import { resetRateLimits } from '../../fixtures/rate-limit';

/**
 * Promo codes, per PRD 4.4 and the seed table in PRD 8.
 *
 * Expiry is the interesting part. The PRD is explicit that it is exclusive and
 * evaluated on the full UTC timestamp, which makes ENDSTODAY — expiring at 23:59:59
 * today — the case that separates a correct implementation from one that truncates to
 * a date.
 */
test.describe('SK-PROMO — promo code validity', () => {
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  /** Puts a cart worth the given amount in front of the promo field. */
  async function cartWorth(
    productPage: { goto: (slug: string) => Promise<void>; addToCartAndWait: () => Promise<void> },
    prefix: string,
    priceCents: number,
  ): Promise<void> {
    const product = await createScopedProduct({
      prefix,
      name: 'Promo Fixture',
      priceCents,
      stockQty: 5,
    });
    await productPage.goto(product.slug);
    await productPage.addToCartAndWait();
  }

  test('SK-PROMO-001 a valid percentage code applies', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-valid`;
    await cleanupScopedData(prefix);
    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.applyPromo('SAVE10');

      await expect(cartPage.promoApplied).toBeVisible();
      await expect(cartPage.discount).toHaveText('-KSh 300.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  /** Entry is case-insensitive; the code is stored and compared uppercase. */
  for (const entry of ['save10', 'SAVE10', 'SaVe10']) {
    test(`SK-PROMO-002 code entry is case-insensitive for "${entry}"`, async ({
      productPage,
      cartPage,
      workerPrefix,
    }) => {
      const prefix = `${workerPrefix}-promo-case-${entry.toLowerCase()}`;
      await cleanupScopedData(prefix);
      try {
        await cartWorth(productPage, prefix, 300_000);
        await cartPage.goto();
        await cartPage.applyPromo(entry);

        await expect(cartPage.promoApplied, `"${entry}" should be accepted`).toBeVisible();
        await expect(cartPage.discount).toHaveText('-KSh 300.00');
      } finally {
        await cleanupScopedData(prefix);
      }
    });
  }

  test('SK-PROMO-003 an unknown code is rejected with a clear message', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-unknown`;
    await cleanupScopedData(prefix);
    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.applyPromo('NOTAREALCODE');

      await expect(cartPage.promoError).toBeVisible();
      await expect(cartPage.promoError).toContainText('not recognised');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-004 an expired code is rejected', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-expired`;
    await cleanupScopedData(prefix);
    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.applyPromo('EXPIRED20');

      await expect(cartPage.promoError).toBeVisible();
      await expect(cartPage.promoError).toContainText('expired');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  /**
   * The boundary case. ENDSTODAY expires at 23:59:59 UTC today, so it must be
   * accepted at any point during today. An implementation that compares dates rather
   * than timestamps rejects it from midnight.
   */
  test('SK-PROMO-005 a code expiring later today is still accepted', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-endstoday`;
    await cleanupScopedData(prefix);

    const promo = await promoByCode('ENDSTODAY');
    const now = new Date();

    // Guard the premise: if the seed is stale this test would be meaningless.
    expect(
      promo.expiresAt.getTime(),
      'ENDSTODAY must expire later today for this case to mean anything',
    ).toBeGreaterThan(now.getTime());

    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.applyPromo('ENDSTODAY');

      await expect(
        cartPage.promoApplied,
        'a code valid until 23:59:59 today must be accepted during today',
      ).toBeVisible();
      await expect(cartPage.discount).toHaveText('-KSh 450.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-006 an inactive code is rejected', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-inactive`;
    await cleanupScopedData(prefix);
    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.applyPromo('DEAD5');

      await expect(cartPage.promoError).toBeVisible();
      await expect(cartPage.promoError).toContainText('no longer available');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-007 a code below its minimum spend is rejected with the threshold named', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-belowmin`;
    await cleanupScopedData(prefix);
    try {
      // SAVE25 needs KSh 3,000; this cart is one cent short.
      await cartWorth(productPage, prefix, 299_999);
      await cartPage.goto();
      await cartPage.applyPromo('SAVE25');

      await expect(cartPage.promoError).toBeVisible();
      await expect(cartPage.promoError).toContainText('KSh 3,000.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-008 a code exactly at its minimum spend is accepted', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-atmin`;
    await cleanupScopedData(prefix);
    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.applyPromo('SAVE25');

      await expect(
        cartPage.promoApplied,
        'the minimum spend is inclusive, so exactly KSh 3,000 qualifies',
      ).toBeVisible();
      await expect(cartPage.discount).toHaveText('-KSh 750.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-009 an applied code can be removed', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-remove`;
    await cleanupScopedData(prefix);
    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.applyPromo('SAVE10');
      await expect(cartPage.promoApplied).toBeVisible();

      await cartPage.removePromo();

      await expect(cartPage.promoInput).toBeVisible();
      await expect(cartPage.total).toHaveText('KSh 3,350.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-010 an empty code entry is rejected', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-empty`;
    await cleanupScopedData(prefix);
    try {
      await cartWorth(productPage, prefix, 300_000);
      await cartPage.goto();
      await cartPage.promoApplyButton.click();

      await expect(cartPage.promoError).toBeVisible();
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-011 a code is dropped if the cart falls below its minimum', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-promo-dropped`;
    await cleanupScopedData(prefix);
    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Promo Drop Fixture',
        priceCents: 160_000,
        stockQty: 5,
      });
      const variant = product.variants[0];
      if (!variant) throw new Error('fixture has no variant');

      // Two at KSh 1,600 is KSh 3,200, which clears SAVE25's KSh 3,000 minimum.
      await productPage.goto(product.slug);
      await productPage.setQuantity(2);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await cartPage.applyPromo('SAVE25');
      await expect(cartPage.promoApplied).toBeVisible();

      // Dropping to one puts the cart below the minimum.
      await cartPage.setQuantity(variant.id, 1);
      await cartPage.goto();

      await expect(
        cartPage.promoInput,
        'a code that no longer qualifies should not stay applied',
      ).toBeVisible();
      await expect(cartPage.total).toHaveText('KSh 1,950.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });
});

/**
 * The single-use code. Kept in its own describe block, serialised, and its usage
 * counter restored afterwards, because consuming it is a global side effect.
 */
test.describe('SK-PROMO — usage limits', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  test.afterAll(async () => {
    await resetPromoUsage('ONESHOT', 0);
  });

  test('SK-PROMO-020 a single-use code is accepted on its first use', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    await resetPromoUsage('ONESHOT', 0);
    const prefix = `${workerPrefix}-promo-oneshot-first`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Single Use Fixture',
        priceCents: 300_000,
        stockQty: 5,
      });
      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await cartPage.applyPromo('ONESHOT');

      await expect(cartPage.promoApplied).toBeVisible();
      await expect(cartPage.discount).toHaveText('-KSh 1,000.00');
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-021 a single-use code is refused once its limit is reached', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    // Simulate the code having already been redeemed.
    await resetPromoUsage('ONESHOT', 1);
    const prefix = `${workerPrefix}-promo-oneshot-second`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Single Use Second Fixture',
        priceCents: 300_000,
        stockQty: 5,
      });
      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await cartPage.applyPromo('ONESHOT');

      await expect(cartPage.promoError).toBeVisible();
      await expect(cartPage.promoError).toContainText('usage limit');
    } finally {
      await cleanupScopedData(prefix);
      await resetPromoUsage('ONESHOT', 0);
    }
  });
});

/**
 * Expiry evaluated against a code whose expiry instant this spec controls, so the
 * boundary can be placed exactly rather than relying on what time the suite runs.
 */
test.describe('SK-PROMO — expiry boundary', () => {
  test.describe.configure({ mode: 'serial' });

  const CODE = 'BOUNDARYTEST';

  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  test.afterEach(async () => {
    await testDb.promoCode.deleteMany({ where: { code: CODE } });
  });

  async function createPromoExpiring(expiresAt: Date): Promise<void> {
    await testDb.promoCode.deleteMany({ where: { code: CODE } });
    await testDb.promoCode.create({
      data: {
        code: CODE,
        type: 'PERCENTAGE',
        value: 10,
        minSpendCents: 0,
        expiresAt,
        maxUses: null,
        isActive: true,
      },
    });
  }

  test('SK-PROMO-030 a code expiring one second from now is still valid', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    // Far enough ahead that the request cannot outrun it, close enough that a
    // date-truncating comparison still sees "today".
    await createPromoExpiring(new Date(Date.now() + 60_000));

    const prefix = `${workerPrefix}-promo-boundary-valid`;
    await cleanupScopedData(prefix);
    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Expiry Boundary Fixture',
        priceCents: 300_000,
        stockQty: 5,
      });
      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await cartPage.applyPromo(CODE);

      await expect(
        cartPage.promoApplied,
        'expiry is exclusive, so a code is valid right up to its instant',
      ).toBeVisible();
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-PROMO-031 a code that expired a second ago is invalid', async ({
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    await createPromoExpiring(new Date(Date.now() - 1_000));

    const prefix = `${workerPrefix}-promo-boundary-expired`;
    await cleanupScopedData(prefix);
    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Expiry Past Fixture',
        priceCents: 300_000,
        stockQty: 5,
      });
      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();

      await cartPage.goto();
      await cartPage.applyPromo(CODE);

      await expect(cartPage.promoError).toBeVisible();
      await expect(cartPage.promoError).toContainText('expired');
    } finally {
      await cleanupScopedData(prefix);
    }
  });
});
