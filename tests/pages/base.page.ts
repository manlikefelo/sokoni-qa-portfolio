import type { Locator, Page } from '@playwright/test';

/**
 * Shared behaviour for every page object.
 *
 * Locators live only in these classes. A spec never writes a selector, which means a
 * markup change is fixed in one file rather than across the suite.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  get cartCount(): Locator {
    return this.page.getByTestId('cart-count');
  }

  get cartLink(): Locator {
    return this.page.getByTestId('nav-cart');
  }

  get loginLink(): Locator {
    return this.page.getByTestId('nav-login');
  }

  get accountLink(): Locator {
    return this.page.getByTestId('nav-account');
  }

  get adminLink(): Locator {
    return this.page.getByTestId('nav-admin');
  }

  get logoutButton(): Locator {
    return this.page.getByTestId('logout-btn');
  }

  get errorBanner(): Locator {
    return this.page.getByTestId('error-banner');
  }

  get notFound(): Locator {
    return this.page.getByTestId('not-found');
  }

  get mobileNavToggle(): Locator {
    return this.page.getByTestId('mobile-nav-toggle');
  }

  get mobileNavPanel(): Locator {
    return this.page.getByTestId('mobile-nav-panel');
  }

  /** Reads the header cart badge as a number. */
  async getCartCount(): Promise<number> {
    const text = await this.cartCount.innerText();
    return Number(text.trim());
  }

  async goToCart(): Promise<void> {
    await this.cartLink.click();
  }

  /** Signs out through whichever navigation this viewport shows. */
  async logout(): Promise<void> {
    if (await this.mobileNavToggle.isVisible()) {
      await this.mobileNavToggle.click();
      await this.page.getByTestId('mobile-nav-logout').click();
      return;
    }
    await this.logoutButton.click();
  }

  /** The admin link this viewport shows, with the mobile menu opened if it is collapsed. */
  async revealAdminLink(): Promise<Locator> {
    if (await this.mobileNavToggle.isVisible()) {
      await this.mobileNavToggle.click();
      return this.page.getByTestId('mobile-nav-admin');
    }
    return this.adminLink;
  }

  /** Reloads the current page. Exposed so specs need no access to `page` itself. */
  async reload(): Promise<void> {
    await this.page.reload();
  }

  /** Waits for navigation to settle on a URL matching the pattern. */
  async waitForUrl(pattern: RegExp): Promise<void> {
    await this.page.waitForURL(pattern);
  }

  /** The current URL, for assertions about query-string state. */
  url(): string {
    return this.page.url();
  }
}
