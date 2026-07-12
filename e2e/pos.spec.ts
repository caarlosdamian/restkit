import { test, expect } from '@playwright/test';
import { OWNER } from './helpers';

/**
 * Full POS lifecycle as a waiter/manager lives it: open the terminal, open
 * the register, mark tables busy, take an order, cook it on the KDS, charge
 * it in cash, and close the register with a balanced cash cut.
 *
 * One test on purpose — each step is the real precondition of the next.
 */
test.describe('POS terminal', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    // Receipts print into a hidden iframe; neutralize the dialog in headless.
    await page.addInitScript(() => {
      window.print = () => {};
    });
  });

  test('terminal login → caja → order → kitchen → payment → cash cut', async ({ page }) => {
    // ── 1. Terminal login (manager credentials) ──
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Abrir terminal' })).toBeVisible();
    await page.getByPlaceholder('gerente@correo.com').fill(OWNER.email);
    await page.getByPlaceholder('••••••••').fill(OWNER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/pos/dashboard');

    // ── 2. Open the register with $500 ──
    await expect(page.getByRole('heading', { name: 'Abrir caja' })).toBeVisible();
    await page.getByPlaceholder('0.00').fill('500');
    await page.getByRole('button', { name: 'Abrir caja' }).click();

    // Table grid appears with the 12 seeded tables, all free.
    await expect(page.getByRole('heading', { name: 'POS — Mesas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todas (12)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ocupadas (0)' })).toBeVisible();

    // ── 3. Manual occupancy: seat guests without an order, then free them ──
    await page.getByRole('button', { name: 'Ocupar' }).first().click();
    await expect(page.getByRole('button', { name: 'Ocupadas (1)' })).toBeVisible();
    await page.getByRole('button', { name: 'Liberar' }).click();
    await expect(page.getByRole('button', { name: 'Ocupadas (0)' })).toBeVisible();

    // ── 4. Open a table and take an order as the manager ──
    const tableLink = page.locator('a[href^="/pos/order/"]').first();
    const orderUrl = (await tableLink.getAttribute('href'))!;
    await tableLink.click();

    // Waiter PIN gate → use the manager escape hatch.
    await page.getByRole('button', { name: 'Continuar como gerente' }).click();

    // Add a product from the seeded menu.
    await page.getByPlaceholder('Buscar producto…').fill('Guacamole');
    await page.getByRole('button', { name: /Guacamole y Chips/ }).first().click();

    // Send the round to the kitchen; confirm the ticket actually landed on
    // the KDS feed (backend truth) before leaving the page.
    await page.getByRole('button', { name: 'Enviar a cocina', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Marcar como lista' }).first()).toBeVisible();
    await expect
      .poll(
        async () => {
          const res = await page.request.get('/api/pos/kitchen');
          return ((await res.json()).tickets ?? []).length;
        },
        { timeout: 20_000 }
      )
      .toBeGreaterThan(0);

    // ── 5. Kitchen Display: the ticket is cooking; bump it ──
    await page.goto('/pos/kitchen');
    await expect(page.getByRole('heading', { name: 'Cocina' })).toBeVisible();
    await expect(page.getByText('Guacamole y Chips').first()).toBeVisible();
    await page.getByRole('button', { name: 'Listo' }).first().click();
    // Fully-bumped tickets leave the queue (order is READY now).
    await expect(page.getByText('Guacamole y Chips')).toHaveCount(0);

    // ── 6. Back at the table: charge the READY order in cash ──
    await page.goto(orderUrl);
    await page.getByRole('button', { name: 'Continuar como gerente' }).click();
    await page.getByRole('button', { name: /Cobrar \$85\.00/ }).first().click();

    await expect(page.getByText('Cobrar orden')).toBeVisible();
    await page.getByRole('button', { name: 'Efectivo' }).click();
    await page.locator('input[type="number"]').fill('200');
    await expect(page.getByText('$115.00').first()).toBeVisible(); // live change calc

    await page.getByRole('button', { name: 'Confirmar pago' }).click();

    // Success screen confirms the change, then returns to the table grid.
    await expect(page.getByText(/Cambio: \$115\.00/)).toBeVisible();
    await page.getByRole('button', { name: 'Listo' }).click();
    await page.waitForURL('**/pos/dashboard');

    // The table is free again and the register shows the sale.
    await expect(page.getByRole('button', { name: 'Ocupadas (0)' })).toBeVisible();
    await expect(page.getByText('Total ventas')).toBeVisible();
    await expect(page.getByText('$85.00').first()).toBeVisible();

    // ── 7. Close the register: $500 opening + $85 cash = $585 expected ──
    await page.getByRole('button', { name: 'Cerrar caja' }).click();
    await expect(page.getByRole('heading', { name: 'Cerrar caja' })).toBeVisible();
    await page.getByPlaceholder('0.00').fill('585');
    await page.getByRole('button', { name: 'Cerrar caja' }).last().click();

    // Cash cut summary balances to zero.
    await expect(page.getByRole('heading', { name: 'Corte de caja' })).toBeVisible();
    await expect(page.getByText('Diferencia')).toBeVisible();
    await expect(page.getByText('$585.00').first()).toBeVisible();
  });

  test('POS pages are gated: no terminal marker sends you to the POS login', async ({ page }) => {
    await page.goto('/pos/dashboard');
    await page.waitForURL('**/pos');
    await expect(page.getByRole('heading', { name: 'Abrir terminal' })).toBeVisible();
  });
});
