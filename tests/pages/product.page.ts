import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class ProductPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get name(): Locator {
    return this.page.getByTestId('product-name');
  }

  get description(): Locator {
    return this.page.getByTestId('product-description');
  }

  get price(): Locator {
    return this.page.getByTestId('product-price');
  }

  get image(): Locator {
    return this.page.getByTestId('product-image');
  }

  get stockIndicator(): Locator {
    return this.page.getByTestId('stock-indicator');
  }

  get quantityInput(): Locator {
    return this.page.getByTestId('quantity-input');
  }

  get addToCartButton(): Locator {
    return this.page.getByTestId('add-to-cart-btn');
  }

  get addToCartSuccess(): Locator {
    return this.page.getByTestId('add-to-cart-success');
  }

  get goToCartLink(): Locator {
    return this.page.getByTestId('go-to-cart-link');
  }

  variantOption(sku: string): Locator {
    return this.page.getByTestId(`variant-option-${sku}`);
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/products/${slug}`);
  }

  async selectVariant(sku: string): Promise<void> {
    await this.variantOption(sku).click();
  }

  async setQuantity(quantity: number): Promise<void> {
    await this.quantityInput.fill(String(quantity));
  }

  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
  }

  /**
   * Adds an item and waits for the outcome: success banner or error. Returning once
   * either is on screen avoids having to guess how long the action takes.
   */
  async addToCartAndWait(): Promise<void> {
    await this.addToCartButton.click();
    await this.page
      .locator('[data-testid="add-to-cart-success"], [data-testid="error-banner"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  /** The max attribute the quantity input advertises, which should track stock. */
  async quantityMax(): Promise<number> {
    const value = await this.quantityInput.getAttribute('max');
    return Number(value);
  }
}
