import { test, expect } from '../../fixtures/base';
import { USERS } from '../../fixtures/users';
import { testDb, createOrderFor, uniqueOrderNumber } from '../../fixtures/db';
import { LoginPage, RegisterPage } from '../../pages/login.page';
import { AccountPage } from '../../pages/account.page';
import { resetRateLimits } from '../../fixtures/rate-limit';

/**
 * Order history, ownership and the address book, per PRD 4.7.
 *
 * These specs use the saved customer session rather than signing in each time, since
 * none of them is about logging in.
 */
test.use({ storageState: USERS.customer.storageState });

test.describe('SK-ACC: order history and ownership', () => {
  // Minted per worker rather than hardcoded. The previous literals sat inside the
  // range order-status.spec.ts draws from at random, so a parallel worker could take
  // one, fail this file's beforeAll on the unique orderNumber column, and leave every
  // spec here hunting a row that was never created. See docs/TRIAGE_NOTES.md.
  const MINE = uniqueOrderNumber();
  const THEIRS = uniqueOrderNumber();

  test.beforeAll(async () => {
    await testDb.orderItem.deleteMany({
      where: { order: { orderNumber: { in: [MINE, THEIRS] } } },
    });
    await testDb.order.deleteMany({ where: { orderNumber: { in: [MINE, THEIRS] } } });

    await createOrderFor({
      email: USERS.customer.email,
      idempotencyKey: `acc-own-${Date.now()}`,
      orderNumber: MINE,
      status: 'PAID',
    });
    await createOrderFor({
      email: USERS.secondCustomer.email,
      idempotencyKey: `acc-other-${Date.now()}`,
      orderNumber: THEIRS,
      status: 'PAID',
    });
  });

  test.afterAll(async () => {
    await testDb.orderItem.deleteMany({
      where: { order: { orderNumber: { in: [MINE, THEIRS] } } },
    });
    await testDb.order.deleteMany({ where: { orderNumber: { in: [MINE, THEIRS] } } });
  });

  test('SK-ACC-040 the order list shows the user’s own order', async ({ accountPage }) => {
    await accountPage.gotoOrders();

    await expect(accountPage.orderRow(MINE)).toBeVisible();
    await expect(accountPage.orderStatus(MINE)).toHaveText('PAID');
    await expect(accountPage.orderTotal(MINE)).toHaveText('KSh 2,450.00');
  });

  test('SK-ACC-041 the order list does not show another user’s order', async ({ accountPage }) => {
    await accountPage.gotoOrders();

    await expect(
      accountPage.orderRow(THEIRS),
      "another customer's order must not appear in this list",
    ).toBeHidden();
  });

  test('SK-ACC-042 the user can open their own order detail', async ({ accountPage }) => {
    await accountPage.gotoOrders();
    await accountPage.orderLink(MINE).click();

    await expect(accountPage.orderDetailNumber).toContainText(MINE);
    await expect(accountPage.orderDetailStatus).toHaveText('PAID');
  });

  /**
   * Ownership through the UI. Requesting another customer's order by number must
   * produce the not-found page, not a forbidden message: a 403 would confirm the
   * order exists.
   */
  test('SK-ACC-043 requesting another user’s order shows not found', async ({
    accountPage,
    page,
  }) => {
    const response = await page.goto(`/account/orders/${THEIRS}`);

    expect(response?.status(), "another user's order must 404, not 403").toBe(404);
    await expect(accountPage.notFound).toBeVisible();
  });

  test('SK-ACC-044 an order number that does not exist shows not found', async ({ page }) => {
    const response = await page.goto('/account/orders/SK-2026-000000');

    expect(response?.status()).toBe(404);
  });
});

test.describe('SK-ACC: profile', () => {
  test('SK-ACC-050 the profile shows the signed-in user’s details', async ({ accountPage }) => {
    await accountPage.gotoProfile();

    await expect(accountPage.profileEmail).toHaveText(USERS.customer.email);
    await expect(accountPage.profileName).toHaveText(USERS.customer.name);
  });

  test('SK-ACC-051 changing a password requires the current one', async ({ accountPage }) => {
    await accountPage.gotoProfile();
    await accountPage.changePassword('TheWrongCurrentOne1', 'BrandNewPass2026');

    await expect(accountPage.fieldError('currentPassword')).toBeVisible();
  });

  test('SK-ACC-052 a new password must meet the policy', async ({ accountPage }) => {
    await accountPage.gotoProfile();
    await accountPage.changePassword(USERS.customer.password, 'weak');

    await expect(accountPage.fieldError('newPassword')).toBeVisible();
  });

  test('SK-ACC-053 the confirmation must match', async ({ accountPage }) => {
    await accountPage.gotoProfile();
    await accountPage.changePassword(
      USERS.customer.password,
      'BrandNewPass2026',
      'DifferentPass2026',
    );

    await expect(accountPage.fieldError('confirmPassword')).toBeVisible();
  });

  /**
   * The happy path, on a throwaway account rather than on the shared seeded customer.
   * Changing the seeded customer's password would invalidate the storageState every
   * other spec in this file depends on: a side effect that would be invisible until
   * something unrelated failed.
   */
  test('SK-ACC-054 a valid password change succeeds and the new password works', async ({
    browser,
    workerPrefix,
    baseURL,
  }) => {
    // Registers once and signs in three times, which is enough under --repeat-each to
    // reach the login limit from a shared IP.
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
    const email = `${workerPrefix}-pwchange-${Date.now()}@example.com`;
    const original = 'OriginalPass2026';
    const replacement = 'ReplacementPass2026';

    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    try {
      const register = new RegisterPage(page);
      const login = new LoginPage(page);
      const account = new AccountPage(page);

      await register.goto();
      await register.registerAndWait('Password Changer', email, original);
      await expect(register.success).toBeVisible();

      await login.goto();
      await login.signIn(email, original);
      await login.waitForUrl(/\/account$/);

      await account.changePassword(original, replacement);
      await expect(account.passwordSuccess).toBeVisible();

      // The old password must stop working and the new one must start.
      await account.logout();
      // Signing out finishes with a redirect home. Opening /login before then still
      // carries the session, and the login page sends a signed-in user away.
      await page.waitForURL('/');
      await login.goto();
      await login.signInExpectingFailure(email, original);

      await login.goto();
      await login.signIn(email, replacement);
      await login.waitForUrl(/\/account$/);
      await expect(account.profileEmail).toHaveText(email);
    } finally {
      await context.close();
      await testDb.user.deleteMany({ where: { email } });
    }
  });
});

/**
 * The address book. Serialised, because these specs share one account's addresses and
 * each builds on a known starting state.
 */
test.describe('SK-ACC: address book', () => {
  test.describe.configure({ mode: 'serial' });

  const FIXTURE = {
    line1: 'Testing Towers, 3rd Floor',
    line2: 'Suite 31',
    city: 'Mombasa',
    county: 'Mombasa',
    postalCode: '80100',
    phone: '0722334455',
  };

  const SEEDED = {
    line1: 'Jacaranda Apartments, Block C',
    line2: 'Apartment 4B',
    city: 'Nairobi',
    county: 'Nairobi',
    postalCode: '00100',
    phone: '0712345678',
  };

  /**
   * Restores this account to exactly one address, the seeded default.
   *
   * Deletes everything and recreates rather than preserving the seeded row, because
   * SK-ACC-065 deliberately deletes the default to check that another is promoted. An
   * earlier version of this helper only removed the *other* addresses and assumed the
   * seeded one was still there, so once that spec had run the account was left empty
   * and every spec after it failed for a reason that had nothing to do with what it
   * was testing.
   */
  async function resetAddresses(): Promise<void> {
    const user = await testDb.user.findUniqueOrThrow({ where: { email: USERS.customer.email } });
    await testDb.address.deleteMany({ where: { userId: user.id } });
    await testDb.address.create({ data: { ...SEEDED, userId: user.id, isDefault: true } });
  }

  test.beforeEach(async () => {
    await resetAddresses();
  });

  test.afterAll(async () => {
    await resetAddresses();
  });

  test('SK-ACC-060 the seeded address is listed and marked default', async ({ accountPage }) => {
    await accountPage.gotoAddresses();

    expect(await accountPage.addressCount()).toBe(1);
    await expect(accountPage.addressList).toContainText('Jacaranda Apartments');
  });

  test('SK-ACC-061 a new address can be added', async ({ accountPage }) => {
    await accountPage.gotoAddresses();
    await accountPage.addAddress(FIXTURE, false);

    await expect(accountPage.addressSuccess).toBeVisible();
    await accountPage.gotoAddresses();
    expect(await accountPage.addressCount()).toBe(2);
    await expect(accountPage.addressList).toContainText('Testing Towers');
  });

  test('SK-ACC-062 a malformed phone number is rejected', async ({ accountPage }) => {
    await accountPage.gotoAddresses();
    await accountPage.addAddress({ ...FIXTURE, phone: '12345' }, false);

    await expect(accountPage.fieldError('phone')).toBeVisible();
    await accountPage.gotoAddresses();
    expect(await accountPage.addressCount(), 'nothing should have been saved').toBe(1);
  });

  test('SK-ACC-063 only one address is default at a time', async ({ accountPage }) => {
    await accountPage.gotoAddresses();
    // Added as the default, which must demote the existing one.
    await accountPage.addAddress(FIXTURE, true);
    await accountPage.gotoAddresses();

    const user = await testDb.user.findUniqueOrThrow({ where: { email: USERS.customer.email } });
    const defaults = await testDb.address.count({ where: { userId: user.id, isDefault: true } });

    expect(defaults, 'exactly one address may carry the default flag').toBe(1);
  });

  test('SK-ACC-064 an address can be deleted', async ({ accountPage }) => {
    await accountPage.gotoAddresses();
    await accountPage.addAddress(FIXTURE, false);
    await accountPage.gotoAddresses();
    expect(await accountPage.addressCount()).toBe(2);

    const user = await testDb.user.findUniqueOrThrow({ where: { email: USERS.customer.email } });
    const added = await testDb.address.findFirstOrThrow({
      where: { userId: user.id, line1: FIXTURE.line1 },
    });

    await accountPage.addressDeleteButton(added.id).click();
    await expect(accountPage.addressSuccess).toBeVisible();

    await accountPage.gotoAddresses();
    expect(await accountPage.addressCount()).toBe(1);
  });

  test('SK-ACC-065 deleting the default promotes another address', async ({ accountPage }) => {
    await accountPage.gotoAddresses();
    await accountPage.addAddress(FIXTURE, false);

    const user = await testDb.user.findUniqueOrThrow({ where: { email: USERS.customer.email } });
    const currentDefault = await testDb.address.findFirstOrThrow({
      where: { userId: user.id, isDefault: true },
    });

    await accountPage.gotoAddresses();
    await accountPage.addressDeleteButton(currentDefault.id).click();
    await expect(accountPage.addressSuccess).toBeVisible();

    const remaining = await testDb.address.findMany({ where: { userId: user.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.isDefault, 'the surviving address should become the default').toBe(true);
  });

  test('SK-ACC-066 another address can be made default', async ({ accountPage }) => {
    await accountPage.gotoAddresses();
    await accountPage.addAddress(FIXTURE, false);

    const user = await testDb.user.findUniqueOrThrow({ where: { email: USERS.customer.email } });
    const added = await testDb.address.findFirstOrThrow({
      where: { userId: user.id, line1: FIXTURE.line1 },
    });

    await accountPage.gotoAddresses();
    await accountPage.addressSetDefaultButton(added.id).click();
    await expect(accountPage.addressSuccess).toBeVisible();

    const refreshed = await testDb.address.findUniqueOrThrow({ where: { id: added.id } });
    expect(refreshed.isDefault).toBe(true);

    const defaults = await testDb.address.count({ where: { userId: user.id, isDefault: true } });
    expect(defaults).toBe(1);
  });
});
