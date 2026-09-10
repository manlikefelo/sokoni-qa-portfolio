import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class CartPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get lines(): Locator {
    return this.page.getByTestId('cart-lines');
  }

  get emptyState(): Locator {
    return this.page.getByTestId('cart-empty');
  }

  get emptyStateShopLink(): Locator {
    return this.page.getByTestId('cart-empty-shop-link');
  }

  get subtotal(): Locator {
    return this.page.getByTestId('cart-subtotal');
  }

  get discount(): Locator {
    return this.page.getByTestId('cart-discount');
  }

  get shipping(): Locator {
    return this.page.getByTestId('cart-shipping');
  }

  get total(): Locator {
    return this.page.getByTestId('cart-total');
  }

  get promoInput(): Locator {
    return this.page.getByTestId('promo-input');
  }

  get promoApplyButton(): Locator {
    return this.page.getByTestId('promo-apply-btn');
  }

  get promoError(): Locator {
    return this.page.getByTestId('promo-error');
  }

  get promoSuccess(): Locator {
    return this.page.getByTestId('promo-success');
  }

  get promoApplied(): Locator {
    return this.page.getByTestId('promo-applied');
  }

  get promoRemoveButton(): Locator {
    return this.page.getByTestId('promo-remove-btn');
  }

  get checkoutButton(): Locator {
    return this.page.getByTestId('checkout-btn');
  }

  line(variantId: string): Locator {
    return this.page.getByTestId(`cart-line-${variantId}`);
  }

  quantityInput(variantId: string): Locator {
    return this.page.getByTestId(`qty-input-${variantId}`);
  }

  unitPrice(variantId: string): Locator {
    return this.page.getByTestId(`cart-unit-price-${variantId}`);
  }

  lineTotal(variantId: string): Locator {
    return this.page.getByTestId(`cart-line-total-${variantId}`);
  }

  removeButton(variantId: string): Locator {
    return this.page.getByTestId(`cart-remove-${variantId}`);
  }

  lineError(variantId: string): Locator {
    return this.page.getByTestId(`cart-error-${variantId}`);
  }

  async goto(): Promise<void> {
    await this.page.goto('/cart');
    await this.page
      .locator('[data-testid="cart-lines"], [data-testid="cart-empty"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  /**
   * Changes a line quantity the way a shopper does — type, then leave the field. The
   * commit happens on blur, so the blur is part of the interaction, not an extra.
   */
  async setQuantity(variantId: string, quantity: number): Promise<void> {
    const input = this.quantityInput(variantId);
    await input.fill(String(quantity));
    await input.blur();
  }

  async removeLine(variantId: string): Promise<void> {
    await this.removeButton(variantId).click();
  }

  async applyPromo(code: string): Promise<void> {
    await this.promoInput.fill(code);
    await this.promoApplyButton.click();
    await this.page
      .locator('[data-testid="promo-applied"], [data-testid="promo-error"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  async removePromo(): Promise<void> {
    await this.promoRemoveButton.click();
    await this.promoInput.waitFor({ state: 'visible' });
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
  }

  /**
   * Counts lines via the quantity input rather than the row, because the
   * `cart-line-` prefix also matches `cart-line-total-`. One quantity input exists
   * per line, so it is an exact count.
   */
  async lineCount(): Promise<number> {
    return this.page.locator('[data-testid^="qty-input-"]').count();
  }
}
