import { test, expect } from '@playwright/test';
import { OWNER_STATE } from './helpers';

test.use({ storageState: OWNER_STATE });

test.describe('Menu management', () => {
  test('creates a product through the form and shows it in its category', async ({ page }) => {
    await page.goto('/dashboard/menu');

    await page.getByRole('button', { name: /Nuevo Producto/ }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Producto' })).toBeVisible();

    await page.getByPlaceholder('Ej. Tacos de pastor').fill('Café Americano E2E');
    await page.getByPlaceholder('0.00').fill('45');
    await page.getByPlaceholder('Ej. Bebidas').fill('Bebidas E2E');
    await page.getByRole('button', { name: 'Guardar' }).click();

    // The list refreshes server-side; the new product and its category appear.
    await expect(page.getByText('Café Americano E2E')).toBeVisible();
    // The category also feeds a hidden <datalist>; assert the visible one.
    await expect(page.getByText('Bebidas E2E').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('$45.00').first()).toBeVisible();
  });
});
