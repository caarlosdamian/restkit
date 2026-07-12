import { test, expect } from '@playwright/test';
import { FRESH_OWNER } from './helpers';

/**
 * Exercises the fresh-database path: a brand-new business, registered through
 * the real /registro flow, with NO seed data. Tables used to have no
 * dashboard UI at all (only the demo seed routes created them), which left
 * a real production business unable to add its own tables. This spec
 * registers its own owner (distinct from the shared OWNER_STATE fixture used
 * by other specs) specifically so it starts from zero.
 */
test.describe('Fresh business: table management', () => {
  test('register with no seed data → add a table from the dashboard → it appears in the POS', async ({
    page,
  }) => {
    await page.goto('/registro');
    await page.locator('#businessName').fill(FRESH_OWNER.businessName);
    await page.locator('#name').fill(FRESH_OWNER.name);
    await page.locator('#email').fill(FRESH_OWNER.email);
    await page.locator('#password').fill(FRESH_OWNER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');

    // Nothing has been seeded — the dashboard tables page starts empty.
    await page.goto('/dashboard/tables');
    await expect(page.getByText('Sin mesas configuradas')).toBeVisible();

    // Add the business's first table through the new UI.
    await page.getByRole('button', { name: /Nueva Mesa/ }).first().click();
    await page.getByPlaceholder('Ej. 1').fill('1');
    await page.getByPlaceholder('Ej. Mesa 1 (por defecto)').fill('Mesa Ventana');
    await page.getByPlaceholder('Ej. Comedor').fill('Comedor');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('Mesa Ventana')).toBeVisible();
    await expect(page.getByText('Comedor (1)')).toBeVisible();

    // Adding a second table with the same number must fail clearly, not crash.
    await page.getByRole('button', { name: /Nueva Mesa/ }).first().click();
    await page.getByPlaceholder('Ej. 1').fill('1');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(/Ya existe una mesa con el número 1/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // The new table is immediately usable from the POS — this is the whole
    // point: a real business can now self-serve table setup end to end.
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await page.goto('/pos');
    await page.getByPlaceholder('gerente@correo.com').fill(FRESH_OWNER.email);
    await page.getByPlaceholder('••••••••').fill(FRESH_OWNER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/pos/dashboard');

    await page.getByPlaceholder('0.00').fill('200');
    await page.getByRole('button', { name: 'Abrir caja' }).click();

    // The card shows the table number and capacity (not the custom name),
    // confirming the table just added from the dashboard is the one seen here.
    await expect(page.getByRole('button', { name: 'Todas (1)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mesa 1 Disponible 4 personas' })).toBeVisible();
  });
});
