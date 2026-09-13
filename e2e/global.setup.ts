import { test as setup, expect } from '@playwright/test';
import { OWNER, OWNER_STATE } from './helpers';
import { seedDemoData, markEmailVerified } from './seed';

/**
 * Runs once before the suite: registers the owner through the real /registro
 * flow (which also creates the Business), confirms the address, signs in, seeds
 * demo data (tables, products, staff, customers), and saves the authenticated
 * session for the other specs.
 *
 * ⚠️ Registration no longer signs anyone in. `requireEmailVerification` means
 * /registro ends on "revisa tu correo" and sign-in is refused until the emailed
 * link is opened — so this confirms the address directly and then logs in. The
 * confirmation flow itself is covered against the real better-auth instance in
 * tests/integration/signup-verification.test.ts; re-walking it here would make
 * every E2E run depend on parsing an email.
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

  // Registration creates the account and the business, then stops: the account
  // cannot be used until the address is confirmed.
  await expect(page.getByText('Revisa tu correo')).toBeVisible({ timeout: 60_000 });

  await markEmailVerified(OWNER.email);

  await page.goto('/login');
  await page.locator('#email').fill(OWNER.email);
  await page.locator('#password').fill(OWNER.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 60_000 });

  const created = await seedDemoData(OWNER.businessName);
  expect(created.tables).toBeGreaterThan(0);

  await page.context().storageState({ path: OWNER_STATE });
});
