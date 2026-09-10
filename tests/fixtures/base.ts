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
