import { test, expect } from '@playwright/test';
import { OWNER_STATE } from './helpers';

test.use({ storageState: OWNER_STATE });

test.describe('Inventory', () => {
  test('creates an item and restocks it through the adjust-stock modal', async ({ page }) => {
    await page.goto('/dashboard/inventory');

    // Create the item.
    // The header and the empty state both offer the button.
    await page.getByRole('button', { name: /Nuevo Artículo/ }).first().click();
    await page.getByPlaceholder('Ej. Queso oaxaca').fill('Queso E2E');
    await page.getByRole('button', { name: 'Guardar' }).click();

    const row = page.locator('tr, div').filter({ hasText: 'Queso E2E' }).last();
    await expect(row).toBeVisible();

    // Restock +10 — RESTOCK is the default movement type in the modal.
    await page.locator('[title="Ajustar stock"]').first().click();
    await page.getByPlaceholder('Ej. 10').fill('10');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByRole('button', { name: 'Aplicar' })).toBeHidden();

    // Quantity reflects the movement (rendered as "10 unidad").
    await expect(page.getByText('Queso E2E').first()).toBeVisible();
    await expect(page.getByText('10 unidad')).toBeVisible();
  });
});
