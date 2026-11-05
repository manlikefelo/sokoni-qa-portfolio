import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { USERS, type UserRole } from './users';

/**
 * Signs in once per role and saves the session to disk. Specs then attach the
 * relevant storageState instead of driving the login form, so a change to the login
 * page breaks the login specs rather than the whole suite.
 *
 * The login specs themselves deliberately do not use this. They are about logging
 * in, so they go through the form.
 */
async function signInAndSave(baseURL: string, role: UserRole): Promise<void> {
  const user = USERS[role];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: baseURL.startsWith('https:'),
  });
  const page = await context.newPage();

  try {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByTestId('login-submit').click();

    // Landing on the account page is the signal that the session is live. Waiting on
    // a UI state rather than a timeout keeps setup deterministic.
    await page.waitForURL(/\/account$/, { timeout: 30_000 });
    await page.getByTestId('profile-email').waitFor({ state: 'visible' });

    mkdirSync(dirname(user.storageState), { recursive: true });
    await context.storageState({ path: user.storageState });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';

  for (const role of Object.keys(USERS) as UserRole[]) {
    await signInAndSave(baseURL, role);
  }
}
