import { test, expect } from '../../fixtures/base';
import { variantBySku, setStock, stockOf } from '../../fixtures/db';

/**
 * Cart behaviour, per PRD 4.3: line items, quantity control, removal, live subtotal,
 * persistence, and the stock ceiling on every path that can change a quantity.
 *
 * These specs run as a guest, so each gets its own cart via its own browser context
 * and they cannot interfere with one another.
 */
test.describe('SK-CART: cart operations', () => {
  test('SK-CART-001 an empty cart shows the empty state and a link to the shop', async ({
    cartPage,
  }) => {
    await cartPage.goto();

    await expect(cartPage.emptyState).toBeVisible();
    await expect(cartPage.emptyStateShopLink).toBeVisible();
    expect(await cartPage.getCartCount()).toBe(0);
  });

  test('SK-CART-002 adding from the product page puts the item in the cart', async ({
    productPage,
    cartPage,
  }) => {
    const variant = await variantBySku('FASH-WALL-BRN');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.addToCartAndWait();
    await expect(productPage.addToCartSuccess).toBeVisible();

    await cartPage.goto();
    await expect(cartPage.line(variant.id)).toBeVisible();
    await expect(cartPage.quantityInput(variant.id)).toHaveValue('1');
    await expect(cartPage.subtotal).toHaveText('KSh 2,100.00');
  });

  test('SK-CART-003 the header count reflects total quantity, not line count', async ({
    productPage,
  }) => {
    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.setQuantity(3);
    await productPage.addToCartAndWait();

    await productPage.goto('premium-cotton-crew-t-shirt');
    await productPage.selectVariant('FASH-CREW-M-WHT');
    await productPage.setQuantity(2);
    await productPage.addToCartAndWait();

    // Two lines, five units. A retrying assertion, because the badge updates after the
    // add-to-cart confirmation appears.
    await expect(productPage.cartCount).toHaveText('5');
  });

  test('SK-CART-004 line total is unit price times quantity', async ({ productPage, cartPage }) => {
    const variant = await variantBySku('FASH-WALL-BRN');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.setQuantity(3);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await expect(cartPage.unitPrice(variant.id)).toContainText('KSh 2,100.00');
    await expect(cartPage.lineTotal(variant.id)).toHaveText('KSh 6,300.00');
  });

  test('SK-CART-005 raising the quantity updates the line total and subtotal', async ({
    productPage,
    cartPage,
  }) => {
    const variant = await variantBySku('FASH-WALL-BRN');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.setQuantity(variant.id, 2);

    await expect(cartPage.lineTotal(variant.id)).toHaveText('KSh 4,200.00');
    await expect(cartPage.subtotal).toHaveText('KSh 4,200.00');
  });

  test('SK-CART-006 removing a line empties the cart', async ({ productPage, cartPage }) => {
    const variant = await variantBySku('FASH-WALL-BRN');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.removeLine(variant.id);

    await expect(cartPage.emptyState).toBeVisible();
    expect(await cartPage.getCartCount()).toBe(0);
  });

  test('SK-CART-007 removing one of two lines leaves the other', async ({
    productPage,
    cartPage,
  }) => {
    const wallet = await variantBySku('FASH-WALL-BRN');
    const shirt = await variantBySku('FASH-CREW-M-WHT');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.addToCartAndWait();

    await productPage.goto('premium-cotton-crew-t-shirt');
    await productPage.selectVariant('FASH-CREW-M-WHT');
    await productPage.addToCartAndWait();

    await cartPage.goto();
    expect(await cartPage.lineCount()).toBe(2);

    await cartPage.removeLine(wallet.id);
    await expect(cartPage.line(wallet.id)).toBeHidden();
    await expect(cartPage.line(shirt.id)).toBeVisible();
    expect(await cartPage.lineCount()).toBe(1);
  });

  test('SK-CART-008 adding the same variant twice accumulates rather than duplicating', async ({
    productPage,
    cartPage,
  }) => {
    const variant = await variantBySku('FASH-WALL-BRN');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.addToCartAndWait();
    await productPage.addToCartAndWait();

    await cartPage.goto();
    expect(await cartPage.lineCount()).toBe(1);
    await expect(cartPage.quantityInput(variant.id)).toHaveValue('2');
  });

  test('SK-CART-009 two variants of one product are separate lines', async ({
    productPage,
    cartPage,
  }) => {
    const brown = await variantBySku('FASH-WALL-BRN');
    const black = await variantBySku('FASH-WALL-BLK');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.addToCartAndWait();
    await productPage.selectVariant('FASH-WALL-BLK');
    await productPage.addToCartAndWait();

    await cartPage.goto();
    expect(await cartPage.lineCount()).toBe(2);
    await expect(cartPage.line(brown.id)).toBeVisible();
    await expect(cartPage.line(black.id)).toBeVisible();
  });

  test('SK-CART-010 the cart survives a reload for a guest', async ({ productPage, cartPage }) => {
    const variant = await variantBySku('FASH-WALL-BRN');

    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.setQuantity(2);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.reload();
    await cartPage.goto();

    await expect(cartPage.quantityInput(variant.id)).toHaveValue('2');
    await expect(cartPage.subtotal).toHaveText('KSh 4,200.00');
  });

  test('SK-CART-011 a sold-out variant cannot be added', async ({ productPage }) => {
    // Every variant of this product is seeded at zero stock.
    await productPage.goto('amazfit-bip-5-smartwatch');

    await expect(productPage.stockIndicator).toContainText('Out of stock');
    await expect(productPage.addToCartButton).toBeDisabled();
  });

  test('SK-CART-012 free shipping appears once the subtotal passes the threshold', async ({
    productPage,
    cartPage,
  }) => {
    // Three wallets at KSh 2,100 is KSh 6,300, comfortably over KSh 5,000.
    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.setQuantity(3);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await expect(cartPage.subtotal).toHaveText('KSh 6,300.00');
    await expect(cartPage.shipping).toHaveText('KSh 0.00');
    await expect(cartPage.total).toHaveText('KSh 6,300.00');
  });

  test('SK-CART-013 shipping is charged below the threshold', async ({ productPage, cartPage }) => {
    await productPage.goto('leather-bifold-wallet');
    await productPage.selectVariant('FASH-WALL-BRN');
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await expect(cartPage.subtotal).toHaveText('KSh 2,100.00');
    await expect(cartPage.shipping).toHaveText('KSh 350.00');
    await expect(cartPage.total).toHaveText('KSh 2,450.00');
  });
});

/**
 * The stock ceiling. PRD 4.3 is explicit that quantity may never exceed stockQty "on
 * every path that can change quantity": so each path is tested separately rather
 * than trusting that one shared check covers them all.
 */
test.describe('SK-CART: stock ceiling', () => {
  // These specs each set the stock of one variant to suit the boundary they are
  // checking, so they must not run concurrently with each other. Serial mode is the
  // honest way to say that: the alternative is a variant per test, which would mean
  // creating fixture products for a property the seeded catalogue already models.
  test.describe.configure({ mode: 'serial' });

  // A variant this group owns outright, so changing its stock cannot disturb
  // another spec.
  const SKU = 'FASH-DUFF-TAN';
  let originalStock = 0;

  test.beforeAll(async () => {
    originalStock = await stockOf(SKU);
  });

  test.afterAll(async () => {
    await setStock(SKU, originalStock);
  });

  test('SK-CART-020 adding exactly the available stock is allowed', async ({
    productPage,
    cartPage,
  }) => {
    await setStock(SKU, 4);
    const variant = await variantBySku(SKU);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.setQuantity(4);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await expect(cartPage.quantityInput(variant.id)).toHaveValue('4');
  });

  /**
   * A quantity above stock is stopped at the input, by the browser's own constraint
   * validation against the max attribute, so the form never submits and nothing
   * reaches the cart.
   *
   * This test originally waited for a server error banner and timed out. That was a
   * bad test: the outer guard fires first, so the server rule is unreachable from
   * here. The server-side check is asserted instead in tests/api/cart-stock.spec.ts,
   * which posts the over-limit quantity directly to the action. See
   * docs/TRIAGE_NOTES.md.
   */
  test('SK-CART-021 a quantity above stock does not reach the cart', async ({
    productPage,
    cartPage,
  }) => {
    await setStock(SKU, 4);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.setQuantity(5);
    await productPage.addToCart();

    await expect(
      productPage.quantityInput,
      'the input should report itself invalid against its max',
    ).toHaveJSProperty('validity.valid', false);

    await cartPage.goto();
    await expect(cartPage.emptyState, 'nothing should have been added').toBeVisible();
  });

  test('SK-CART-022 the quantity input advertises stock as its ceiling', async ({
    productPage,
  }) => {
    await setStock(SKU, 4);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);

    expect(await productPage.quantityMax()).toBe(4);
  });

  /**
   * The cart page is a second, independent path to changing quantity. The PRD
   * requires the ceiling to hold here too.
   */
  test('SK-CART-023 raising the cart quantity above stock is refused', async ({
    productPage,
    cartPage,
  }) => {
    await setStock(SKU, 2);
    const variant = await variantBySku(SKU);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.setQuantity(variant.id, 9);

    await expect(
      cartPage.lineError(variant.id),
      'the cart page must refuse a quantity above available stock',
    ).toBeVisible();
    await expect(cartPage.quantityInput(variant.id)).toHaveValue('1');
  });

  test('SK-CART-024 the refused quantity is not persisted', async ({ productPage, cartPage }) => {
    await setStock(SKU, 2);
    const variant = await variantBySku(SKU);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.setQuantity(variant.id, 9);
    await cartPage.goto();

    // Reloading is what proves the rejection reached the database rather than being
    // reverted only in the browser.
    await expect(
      cartPage.quantityInput(variant.id),
      'after a reload the stored quantity must still be within stock',
    ).toHaveValue('1');
  });

  test('SK-CART-025 setting the cart quantity to exactly stock is allowed', async ({
    productPage,
    cartPage,
  }) => {
    await setStock(SKU, 3);
    const variant = await variantBySku(SKU);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.setQuantity(variant.id, 3);
    await cartPage.goto();

    await expect(cartPage.quantityInput(variant.id)).toHaveValue('3');
  });

  test('SK-CART-026 a quantity of zero is rejected', async ({ productPage, cartPage }) => {
    await setStock(SKU, 5);
    const variant = await variantBySku(SKU);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.setQuantity(variant.id, 0);
    await cartPage.goto();

    // Zero is not a way to remove a line; removal has its own control.
    await expect(cartPage.quantityInput(variant.id)).toHaveValue('1');
  });

  test('SK-CART-027 a negative quantity is rejected', async ({ productPage, cartPage }) => {
    await setStock(SKU, 5);
    const variant = await variantBySku(SKU);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    await cartPage.setQuantity(variant.id, -3);
    await cartPage.goto();

    await expect(cartPage.quantityInput(variant.id)).toHaveValue('1');
  });

  test('SK-CART-028 a non-numeric quantity is rejected', async ({ productPage, cartPage }) => {
    await setStock(SKU, 5);
    const variant = await variantBySku(SKU);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.addToCartAndWait();

    await cartPage.goto();
    const input = cartPage.quantityInput(variant.id);
    // Typed key by key, because fill() refuses non-numeric text on a number input. A
    // shopper's keystrokes have no such restriction.
    await input.clear();
    await input.pressSequentially('abc');
    await input.blur();
    await cartPage.goto();

    await expect(cartPage.quantityInput(variant.id)).toHaveValue('1');
  });

  test('SK-CART-029 adding in two steps cannot exceed stock in total', async ({ productPage }) => {
    await setStock(SKU, 3);

    await productPage.goto('canvas-weekend-duffel-bag');
    await productPage.selectVariant(SKU);
    await productPage.setQuantity(2);
    await productPage.addToCartAndWait();

    // Two already held plus two more is four, above the three in stock.
    await productPage.setQuantity(2);
    await productPage.addToCartAndWait();

    await expect(productPage.errorBanner).toBeVisible();
  });
});
