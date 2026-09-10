import { test, expect } from '../../fixtures/base';
import { USERS } from '../../fixtures/users';
import { testDb } from '../../fixtures/db';
import { resetRateLimits } from '../../fixtures/rate-limit';

/**
 * Registration and sign-in, per PRD 4.7.
 *
 * These specs drive the forms rather than using a saved session, because the forms are
 * what they are about. Accounts they create are namespaced per worker and removed
 * afterwards.
 */
test.describe('SK-ACC — registration', () => {
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  test('SK-ACC-001 a valid registration succeeds', async ({ registerPage, workerPrefix }) => {
    const email = `${workerPrefix}-new-${Date.now()}@example.com`;
    try {
      await registerPage.goto();
      await registerPage.registerAndWait('Grace Wanjiru', email, 'StrongPass2026');

      await expect(registerPage.success).toBeVisible();

      const created = await testDb.user.findUnique({ where: { email } });
      expect(created, 'the account should exist afterwards').toBeTruthy();
      expect(created?.role, 'a new account is a customer, never an admin').toBe('CUSTOMER');
      expect(
        created?.passwordHash.startsWith('$argon2id$'),
        'the password must be stored as an argon2id hash',
      ).toBe(true);
      expect(created?.passwordHash).not.toContain('StrongPass2026');
    } finally {
      await testDb.user.deleteMany({ where: { email } });
    }
  });

  test('SK-ACC-002 a duplicate email returns a generic failure', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.registerAndWait('Someone Else', USERS.customer.email, 'StrongPass2026');

    await expect(registerPage.error).toBeVisible();

    // The message must not confirm that the address is already registered.
    const message = await registerPage.error.innerText();
    expect(
      message.toLowerCase(),
      'the failure must not reveal that the email is taken',
    ).not.toContain('already');
    expect(message.toLowerCase()).not.toContain('exists');
    expect(message.toLowerCase()).not.toContain('taken');
  });

  const weakPasswords = [
    { id: 'SK-ACC-003', label: 'too short', value: 'Short1' },
    { id: 'SK-ACC-004', label: 'no digit', value: 'NoDigitsHereAtAll' },
    { id: 'SK-ACC-005', label: 'no letter', value: '1234567890123' },
  ];

  for (const password of weakPasswords) {
    test(`${password.id} a password that is ${password.label} is rejected`, async ({
      registerPage,
      workerPrefix,
    }) => {
      const email = `${workerPrefix}-weak-${Date.now()}@example.com`;
      try {
        await registerPage.goto();
        await registerPage.registerAndWait('Weak Password', email, password.value);

        await expect(registerPage.fieldError('password')).toBeVisible();
        expect(
          await testDb.user.findUnique({ where: { email } }),
          'no account should be created',
        ).toBeNull();
      } finally {
        await testDb.user.deleteMany({ where: { email } });
      }
    });
  }

  test('SK-ACC-006 a password of exactly ten characters is accepted', async ({
    registerPage,
    workerPrefix,
  }) => {
    const email = `${workerPrefix}-tenchar-${Date.now()}@example.com`;
    try {
      await registerPage.goto();
      // Exactly ten, with a letter and a digit: the stated minimum, inclusive.
      await registerPage.registerAndWait('Ten Char', email, 'Abcdefgh12');

      await expect(registerPage.success).toBeVisible();
      expect(await testDb.user.findUnique({ where: { email } })).toBeTruthy();
    } finally {
      await testDb.user.deleteMany({ where: { email } });
    }
  });

  test('SK-ACC-007 a password of nine characters is rejected', async ({
    registerPage,
    workerPrefix,
  }) => {
    const email = `${workerPrefix}-ninechar-${Date.now()}@example.com`;
    try {
      await registerPage.goto();
      await registerPage.registerAndWait('Nine Char', email, 'Abcdefg12');

      await expect(registerPage.fieldError('password')).toBeVisible();
      expect(await testDb.user.findUnique({ where: { email } })).toBeNull();
    } finally {
      await testDb.user.deleteMany({ where: { email } });
    }
  });

  test('SK-ACC-008 an email is normalised to lowercase', async ({ registerPage, workerPrefix }) => {
    const lower = `${workerPrefix}-case-${Date.now()}@example.com`;
    try {
      await registerPage.goto();
      await registerPage.registerAndWait('Mixed Case', lower.toUpperCase(), 'StrongPass2026');

      await expect(registerPage.success).toBeVisible();
      expect(
        await testDb.user.findUnique({ where: { email: lower } }),
        'the address should be stored lowercased so it cannot be registered twice',
      ).toBeTruthy();
    } finally {
      await testDb.user.deleteMany({ where: { email: lower } });
    }
  });
});

/**
 * Sign-in. The central requirement is that a wrong password and an unknown email give
 * the same answer, so the form cannot be used to discover which addresses have
 * accounts.
 */
test.describe('SK-ACC — sign in', () => {
  test.beforeEach(async ({ baseURL }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });

  test('SK-ACC-020 valid credentials sign the user in', async ({
    loginPage,
    accountPage,
    baseURL,
  }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await expect(accountPage.profileEmail).toHaveText(USERS.customer.email);
  });

  test('SK-ACC-021 a wrong password is refused', async ({ loginPage }) => {
    await loginPage.goto();
    const message = await loginPage.signInExpectingFailure(
      USERS.customer.email,
      'DefinitelyWrong2026',
    );

    expect(message.length).toBeGreaterThan(0);
  });

  test('SK-ACC-022 an unknown email is refused', async ({ loginPage }) => {
    await loginPage.goto();
    const message = await loginPage.signInExpectingFailure(
      'nobody-at-all@example.com',
      'DefinitelyWrong2026',
    );

    expect(message.length).toBeGreaterThan(0);
  });

  /**
   * The no-enumeration requirement, asserted directly: the two failure messages must
   * be byte-identical.
   */
  test('SK-ACC-023 both failure messages are identical', async ({ loginPage, baseURL }) => {
    const url = baseURL ?? 'http://localhost:3000';

    /**
     * The buckets are cleared immediately before each attempt rather than once for the
     * test.
     *
     * Under --repeat-each this test originally compared two *rate-limit* notices
     * instead of two credential failures, and those carry a countdown: "try again in
     * 734 seconds" against "733 seconds". The assertion failed on a one-second
     * difference between two messages that were both correct.
     *
     * The limiter is behaving properly — this test simply has to guarantee it is
     * looking at the message it claims to be looking at.
     */
    await resetRateLimits(url);
    await loginPage.goto();
    const wrongPassword = await loginPage.signInExpectingFailure(
      USERS.customer.email,
      'DefinitelyWrong2026',
    );

    await resetRateLimits(url);
    await loginPage.goto();
    const unknownEmail = await loginPage.signInExpectingFailure(
      'nobody-at-all@example.com',
      'DefinitelyWrong2026',
    );

    expect(
      wrongPassword,
      'this test must compare credential failures, not rate-limit notices',
    ).not.toMatch(/too many attempts/i);
    expect(unknownEmail, 'a wrong password and an unknown email must be indistinguishable').toBe(
      wrongPassword,
    );
  });

  test('SK-ACC-024 signing out ends the session', async ({
    loginPage,
    accountPage,
    page,
    baseURL,
  }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
    await loginPage.goto();
    await loginPage.signIn(USERS.customer.email, USERS.customer.password);
    await loginPage.waitForUrl(/\/account$/);

    await accountPage.logout();
    await page.waitForURL('/');

    // The account area is no longer reachable.
    const response = await page.goto('/account');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login/);
  });

  test('SK-ACC-025 the login form is reachable from the register page and back', async ({
    registerPage,
    loginPage,
  }) => {
    await registerPage.goto();
    await registerPage.loginLinkFromRegister.click();
    await expect(loginPage.form).toBeVisible();

    await loginPage.registerLink.click();
    await expect(registerPage.form).toBeVisible();
  });
});

/**
 * Rate limiting on sign-in, per PRD 7: ten attempts per fifteen minutes per IP.
 *
 * This spec deliberately exhausts a shared, process-wide limiter. Everything in the
 * suite shares one IP, so while it runs, any other spec that signs in or registers is
 * liable to be refused — and clearing the bucket in a neighbour's beforeEach does not
 * help, because this spec refills it immediately afterwards.
 *
 * Marked @serial-global and excluded from the default run for that reason. It is
 * executed as its own step in CI, after the parallel suite has finished, where it has
 * the limiter to itself. Running it inside the parallel suite produced exactly the kind
 * of cross-spec interference the reliability rules forbid — it was found under
 * --repeat-each, where the doubled attempt count made the collision certain rather than
 * occasional.
 */
test.describe('SK-ACC — sign-in rate limiting @serial-global', () => {
  test.describe.configure({ mode: 'serial' });

  test('SK-ACC-030 repeated failures are eventually rate limited', async ({
    loginPage,
    baseURL,
  }) => {
    await resetRateLimits(baseURL ?? 'http://localhost:3000');

    let limited = false;
    // Eleven attempts against a limit of ten.
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      await loginPage.goto();
      const message = await loginPage.signInExpectingFailure(
        'nobody-at-all@example.com',
        'WrongPassword2026',
      );
      if (/too many attempts/i.test(message)) {
        limited = true;
        break;
      }
    }

    expect(limited, 'a run of failed sign-ins should eventually be refused outright').toBe(true);

    // Leave the bucket clean for whatever runs next.
    await resetRateLimits(baseURL ?? 'http://localhost:3000');
  });
});
