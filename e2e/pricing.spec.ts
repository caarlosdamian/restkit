import { test, expect } from '@playwright/test';

/**
 * The pricing section is interactive and plan-aware: the monthly/annual toggle
 * recomputes prices, and choosing a plan carries it into /registro so signup
 * knows which plan (and starts the business on that plan's trial).
 */
test.describe('Landing pricing', () => {
  test('annual toggle lowers prices and plan CTA carries the plan into signup', async ({ page }) => {
    await page.goto('/#precios');

    // Básico is $599/mo monthly; annual applies the 20% discount → $479.
    await expect(page.getByText('$599').first()).toBeVisible();
    await page.getByRole('button', { name: /Anual/ }).click();
    await expect(page.getByText('$479').first()).toBeVisible();
    await expect(page.getByText('$599')).toHaveCount(0);

    // The "Profesional" plan CTA carries plan + period into registration.
    await page
      .locator('a[href="/registro?plan=pro&period=annual"]')
      .first()
      .click();
    await page.waitForURL('**/registro?plan=pro&period=annual');
    await expect(page.getByText(/Plan Profesional/)).toBeVisible();
    await expect(page.getByText(/prueba gratis, sin tarjeta/)).toBeVisible();
  });

  test('enterprise plan contacts sales instead of signing up', async ({ page }) => {
    await page.goto('/#precios');
    const salesLink = page.locator('a[href^="mailto:"]').first();
    await expect(salesLink).toBeVisible();
    await expect(salesLink).toHaveText(/Hablar con ventas/);
  });
});
