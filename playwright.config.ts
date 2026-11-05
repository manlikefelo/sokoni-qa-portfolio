import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
// CI serves the app over HTTPS with a throwaway certificate. See scripts/https-proxy.mjs.
const IGNORE_HTTPS_ERRORS = BASE_URL.startsWith('https:');

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/fixtures/global-setup.ts',

  /**
   * Zero retries, deliberately. A test that passes on the second attempt is not a
   * passing test — it is an unanswered question about the application or the suite.
   * Retries would hide exactly the flakiness this suite exists to rule out. The
   * reasoning is set out in docs/TEST_STRATEGY.md.
   */
  retries: 0,

  /**
   * Specs tagged @serial-global exhaust a process-wide resource — currently just the
   * rate limiter — and cannot share the application with a parallel suite, so they are
   * excluded from the default run and executed separately afterwards.
   *
   * Driven by an environment variable rather than a bare `grepInvert`, because a
   * `grepInvert` in the config wins over `--grep` on the command line: with the filter
   * hard-coded, `--grep @serial-global` matched nothing and silently ran zero tests.
   * `npm run test:serial` sets SERIAL_ONLY to invert the selection.
   */
  grep: process.env.SERIAL_ONLY ? /@serial-global/ : undefined,
  grepInvert: process.env.SERIAL_ONLY ? undefined : /@serial-global/,

  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['list'],
      ]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    testIdAttribute: 'data-testid',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    // Production build, because several assertions are about HTTP status codes and
    // Next.js streams differently in development.
    command: 'npm run build && npm run start',
    url: BASE_URL,
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
