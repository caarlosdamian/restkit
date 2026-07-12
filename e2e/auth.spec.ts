import { test, expect } from '@playwright/test';
import { OWNER } from './helpers';

// Fresh context on purpose — these tests exercise the login UX itself.

test.describe('Login', () => {
  test('rejects wrong credentials with a visible error, without navigating', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(OWNER.email);
    await page.locator('#password').fill('contraseña-incorrecta');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('.text-red-700, [class*="text-red"]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in and lands on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(OWNER.email);
    await page.locator('#password').fill(OWNER.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/dashboard');
    // Landed on the analytics home with the sidebar rendered.
    await expect(page.locator('a[href="/dashboard/menu"]').first()).toBeVisible();
  });

  test('unauthenticated visitors are redirected away from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
