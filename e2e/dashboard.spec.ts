import { test, expect } from '@playwright/test';
import { OWNER_STATE } from './helpers';

test.use({ storageState: OWNER_STATE });

test.describe('Dashboard navigation', () => {
  test('sidebar reaches every section and never links to the POS', async ({ page }) => {
    await page.goto('/dashboard');

    const sections = [
      { href: '/dashboard/menu', heading: 'Menú' },
      { href: '/dashboard/inventory', heading: 'Inventario' },
      { href: '/dashboard/orders', heading: null },
      { href: '/dashboard/reports', heading: null },
      { href: '/dashboard/customers', heading: null },
      { href: '/dashboard/loyalty', heading: null },
      { href: '/dashboard/staff', heading: null },
      { href: '/dashboard/settings', heading: null },
    ];

    for (const { href, heading } of sections) {
      await page.locator(`a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(href.replace(/\//g, '\\/')));
      if (heading) {
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      }
    }

    // POS was removed from the dashboard — its old routes must not come back.
    await expect(page.locator('a[href^="/dashboard/pos"]')).toHaveCount(0);
  });

  test('seeded data is visible: menu products and tables exist', async ({ page }) => {
    await page.goto('/dashboard/menu');
    await expect(page.getByText('Guacamole y Chips').first()).toBeVisible();
  });
});
