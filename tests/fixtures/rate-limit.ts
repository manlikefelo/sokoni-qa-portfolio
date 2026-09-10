import { request as playwrightRequest } from '@playwright/test';

/**
 * Clears the application's rate-limit buckets.
 *
 * Login, registration and promo application are limited to ten attempts per fifteen
 * minutes per IP — a PRD 7 requirement with its own tests. Every spec in a run shares
 * one IP, so a suite that applies promo codes dozens of times trips the limiter and
 * starts failing for a reason that has nothing to do with what it is testing.
 *
 * Weakening the limiter for tests would mean not testing the real thing. Instead the
 * suite resets the buckets between specs through a route that only answers when
 * TEST_SUPPORT_TOKEN is set and refuses outright in production.
 */
const TOKEN = process.env.TEST_SUPPORT_TOKEN ?? 'local-test-support-token-value';

export async function resetRateLimits(urlOrBaseUrl: string): Promise<void> {
  // Accepts either a baseURL or any page URL, so a page object can pass what it has.
  const origin = new URL(urlOrBaseUrl).origin;
  const context = await playwrightRequest.newContext({ baseURL: origin });
  try {
    const response = await context.post('/api/test-support/reset-rate-limit', {
      headers: { 'x-test-support-token': TOKEN },
    });

    if (!response.ok()) {
      throw new Error(
        `Could not reset rate limits (HTTP ${response.status()}). Is TEST_SUPPORT_TOKEN set for the server under test?`,
      );
    }
  } finally {
    await context.dispose();
  }
}
