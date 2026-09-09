import { test as setup, expect } from '@playwright/test';
import { OWNER, OWNER_STATE } from './helpers';
import { seedDemoData } from './seed';

/**
 * Runs once before the suite: registers the owner through the real /registro
 * flow (which also creates the Business), seeds demo data (tables, products,
 * staff, customers), and saves the authenticated session for the other specs.
 *
 * The seed writes straight to the test database. It used to POST to
 * /api/restaurants/seed-current — a demo-data route that shipped with the
 * product. Fixtures for the test suite have no business being reachable from a
 * deployment serving real restaurants.
 */
setup('register owner and seed demo data', async ({ page }) => {
  await page.goto('/registro');

  await page.locator('#businessName').fill(OWNER.businessName);
  await page.locator('#name').fill(OWNER.name);
  await page.locator('#email').fill(OWNER.email);
  await page.locator('#password').fill(OWNER.password);
  await page.locator('button[type="submit"]').click();

  // Registration signs up, creates the business, then redirects.
  await page.waitForURL('**/dashboard', { timeout: 60_000 });

  const created = await seedDemoData(OWNER.businessName);
  expect(created.tables).toBeGreaterThan(0);

  await page.context().storageState({ path: OWNER_STATE });
});
