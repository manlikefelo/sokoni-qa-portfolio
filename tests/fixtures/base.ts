import { test as base, expect } from '@playwright/test';
import { CataloguePage } from '../pages/catalogue.page';
import { ProductPage } from '../pages/product.page';
import { CartPage } from '../pages/cart.page';
import { CheckoutPage } from '../pages/checkout.page';
import { LoginPage, RegisterPage } from '../pages/login.page';
import { AccountPage } from '../pages/account.page';
import { AdminPage } from '../pages/admin.page';

/**
 * Page objects as fixtures, so a spec declares what it needs and never constructs
 * one by hand. Every spec imports `test` and `expect` from here rather than from
 * @playwright/test directly.
 */
interface Pages {
  cataloguePage: CataloguePage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  accountPage: AccountPage;
  adminPage: AdminPage;
}

interface WorkerFixtures {
  /**
   * A prefix unique to this worker, for namespacing data a spec creates. Keeps
   * parallel workers from colliding on slugs, SKUs and order numbers.
   */
  workerPrefix: string;
}

export const test = base.extend<Pages, WorkerFixtures>({
  workerPrefix: [
    async ({}, use, workerInfo) => {
      await use(`w${workerInfo.workerIndex}`);
    },
    { scope: 'worker' },
  ],

  /**
   * Every request from a worker carries an x-forwarded-for address unique to that
   * worker, which the application already honours when keying its rate limiter.
   *
   * This is what makes the limiter workable under parallelism. Login, registration and
   * promo application allow ten attempts per fifteen minutes per IP, and the whole
   * suite would otherwise share one bucket: eight registration specs under
   * --repeat-each is sixteen attempts, and they start refusing each other. Clearing the
   * bucket between tests does not fix it, because a parallel worker can consume the
   * allowance between the reset and the submission: an inherent race, and chasing it
   * with more resets only narrows the window.
   *
   * Giving each worker its own address removes the contention instead of papering over
   * it. The limiter itself is untouched, still at production strength, and is tested at
   * its boundary by SK-ACC-030: which runs alone, with the real shared bucket.
   */
  extraHTTPHeaders: [
    async ({ workerPrefix }, use) => {
      await use({ 'x-forwarded-for': `10.0.0.${10 + Number(workerPrefix.slice(1))}` });
    },
    { scope: 'test' },
  ],

  cataloguePage: async ({ page }, use) => {
    await use(new CataloguePage(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  accountPage: async ({ page }, use) => {
    await use(new AccountPage(page));
  },
  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },
});

export { expect };
