import { test, expect } from './fixtures/base';
import { countSeed, EXPECTED_SEED } from './fixtures/db';

/**
 * A minimal check that the environment is wired up: the application serves, and the
 * database holds the dataset every other spec assumes. If this fails, nothing else
 * in the suite is meaningful.
 */
test.describe('SK-SMOKE — environment', () => {
  test('SK-SMOKE-001 the catalogue page loads', async ({ cataloguePage }) => {
    await cataloguePage.goto();
    await expect(cataloguePage.grid).toBeVisible();
  });

  test('SK-SMOKE-002 the seed dataset matches what the suite expects', async () => {
    expect(await countSeed()).toEqual(EXPECTED_SEED);
  });
});
