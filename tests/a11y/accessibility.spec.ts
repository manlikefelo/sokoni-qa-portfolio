import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';
import { USERS } from '../fixtures/users';
import { createScopedProduct, cleanupScopedData } from '../fixtures/db';

/**
 * Accessibility, per PRD 5 and the test spec's section 5.9: axe-core across the six
 * covered pages with zero critical and zero serious violations, plus keyboard-only
 * traversal of the purchase journey and visible focus.
 *
 * Moderate and minor findings are printed but not failed on. That is a deliberate
 * line. Critical and serious violations stop people using the site; the lower two
 * tiers are frequently contextual, and failing on them makes the gate noisy enough
 * that people start ignoring it. Reporting them keeps them visible rather than
 * silently dropped.
 */
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: Array<{ target: unknown[] }>;
}

function summarise(violations: AxeViolation[]): string {
  if (violations.length === 0) return '  (none)';
  return violations
    .map(
      (violation) =>
        `  [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length} node${
          violation.nodes.length === 1 ? '' : 's'
        })`,
    )
    .join('\n');
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const all = results.violations as unknown as AxeViolation[];
  const blocking = all.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));
  const advisory = all.filter((violation) => !BLOCKING_IMPACTS.has(violation.impact ?? ''));

  if (advisory.length > 0) {
    console.warn(`axe advisory findings, not failed on:\n${summarise(advisory)}`);
  }

  return { blocking, advisory };
}

test.describe('SK-A11Y: axe-core, anonymous pages', () => {
  const pages = [
    { id: 'SK-A11Y-001', name: 'home', path: '/' },
    { id: 'SK-A11Y-002', name: 'catalogue', path: '/products' },
    { id: 'SK-A11Y-003', name: 'product detail', path: '/products/leather-bifold-wallet' },
    { id: 'SK-A11Y-004', name: 'empty cart', path: '/cart' },
    { id: 'SK-A11Y-005', name: 'sign in', path: '/login' },
    { id: 'SK-A11Y-006', name: 'register', path: '/register' },
  ];

  for (const target of pages) {
    test(`${target.id} ${target.name} has no critical or serious violations`, async ({ page }) => {
      await page.goto(target.path);
      const { blocking } = await scan(page);

      expect(
        blocking,
        `${target.name} should have no critical or serious violations:\n${summarise(blocking)}`,
      ).toEqual([]);
    });
  }
});

test.describe('SK-A11Y: axe-core, pages needing state', () => {
  test('SK-A11Y-010 a cart with items has no critical or serious violations', async ({
    page,
    productPage,
    cartPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-a11y-cart`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Accessibility Cart Fixture',
        priceCents: 210_000,
        stockQty: 5,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();
      await cartPage.goto();

      const { blocking } = await scan(page);
      expect(blocking, `cart with items:\n${summarise(blocking)}`).toEqual([]);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-A11Y-011 the checkout address step has no critical or serious violations', async ({
    page,
    productPage,
    cartPage,
    checkoutPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-a11y-checkout`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Accessibility Checkout Fixture',
        priceCents: 210_000,
        stockQty: 5,
      });

      await productPage.goto(product.slug);
      await productPage.addToCartAndWait();
      await cartPage.goto();
      await cartPage.proceedToCheckout();
      await expect(checkoutPage.addressForm).toBeVisible();

      const { blocking } = await scan(page);
      expect(blocking, `checkout address step:\n${summarise(blocking)}`).toEqual([]);
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-A11Y-012 the account area has no critical or serious violations', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: USERS.customer.storageState });
    try {
      const page = await context.newPage();
      await page.goto('/account');
      const { blocking } = await scan(page);

      expect(blocking, `account profile:\n${summarise(blocking)}`).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('SK-A11Y: keyboard and focus', () => {
  test('SK-A11Y-020 the skip link is the first thing a keyboard user reaches', async ({ page }) => {
    await page.goto('/products');
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim(),
      href: document.activeElement?.getAttribute('href'),
    }));

    expect(focused.text).toBe('Skip to main content');
    expect(focused.href).toBe('#main');
  });

  test('SK-A11Y-021 focus is visibly indicated', async ({ page }) => {
    await page.goto('/products');
    await page.keyboard.press('Tab');

    /**
     * An outline of "none" with nothing in its place is the usual way this requirement
     * gets quietly broken, so both an outline and a box shadow count as satisfying it.
     */
    const style = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element) return null;
      const computed = window.getComputedStyle(element);
      return {
        outlineStyle: computed.outlineStyle,
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow,
      };
    });

    expect(style).not.toBeNull();
    const hasVisibleFocus =
      (style?.outlineStyle !== 'none' && style?.outlineWidth !== '0px') ||
      (style?.boxShadow !== 'none' && style?.boxShadow !== '');

    expect(hasVisibleFocus, 'a focused element must carry a visible focus indicator').toBe(true);
  });

  test('SK-A11Y-022 a product can be added to the cart with the keyboard alone', async ({
    page,
    productPage,
    workerPrefix,
  }) => {
    const prefix = `${workerPrefix}-a11y-keyboard`;
    await cleanupScopedData(prefix);

    try {
      const product = await createScopedProduct({
        prefix,
        name: 'Keyboard Journey Fixture',
        priceCents: 210_000,
        stockQty: 5,
      });

      await productPage.goto(product.slug);

      // Tab forward until the add-to-cart button has focus, then activate it from the
      // keyboard rather than clicking.
      let reached = false;
      for (let step = 0; step < 40; step += 1) {
        await page.keyboard.press('Tab');
        const testId = await page.evaluate(() =>
          document.activeElement?.getAttribute('data-testid'),
        );
        if (testId === 'add-to-cart-btn') {
          reached = true;
          break;
        }
      }

      expect(reached, 'the add-to-cart button must be reachable by tabbing').toBe(true);

      await page.keyboard.press('Enter');
      await expect(productPage.addToCartSuccess).toBeVisible();
    } finally {
      await cleanupScopedData(prefix);
    }
  });

  test('SK-A11Y-023 every page has exactly one level-one heading', async ({ page }) => {
    for (const path of ['/', '/products', '/products/leather-bifold-wallet', '/cart', '/login']) {
      await page.goto(path);
      const count = await page.locator('h1').count();

      expect(count, `${path} should have exactly one h1`).toBe(1);
    }
  });

  test('SK-A11Y-024 every image carries alt text or is marked decorative', async ({
    page,
    cataloguePage,
  }) => {
    await cataloguePage.goto();
    await expect(cataloguePage.grid).toBeVisible();

    const images = await page.locator('img').all();
    expect(images.length).toBeGreaterThan(0);

    for (const image of images) {
      const alt = await image.getAttribute('alt');
      const ariaHidden = await image.evaluate(
        (element) => element.closest('[aria-hidden="true"]') !== null,
      );

      /**
       * An empty alt is correct for a decorative image whose link is labelled
       * elsewhere. What must never happen is a missing alt attribute, which leaves a
       * screen reader to read out the file name.
       */
      expect(
        alt !== null || ariaHidden,
        'an image must carry an alt attribute or sit inside aria-hidden content',
      ).toBe(true);
    }
  });
});
