import { test as setup, expect } from '@playwright/test';
import { OWNER, OWNER_STATE } from './helpers';

/**
 * Runs once before the suite: registers the owner through the real /registro
 * flow (which also creates the Business), seeds demo data (tables, products,
 * staff, customers), and saves the authenticated session for the other specs.
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

  // Seed demo data through the app's own endpoint (cookies shared with page).
  const res = await page.request.post('/api/restaurants/seed-current');
  expect(res.ok(), `seed failed: ${await res.text()}`).toBeTruthy();

  await page.context().storageState({ path: OWNER_STATE });
});
