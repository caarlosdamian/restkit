import { test, expect } from '@playwright/test';

/**
 * The hero's "Ver cómo se arma" walkthrough.
 *
 * It is the first thing a stranger sees of the product and the only place the
 * real card appears before signing up, so the things worth holding are: it
 * opens without an account, the two choices it offers genuinely change the
 * card, and it ends pointing at /registro.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const next = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Siguiente/ }).click();

test.describe('Card demo', () => {
  test('walks five steps from a business to a real card', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Ver cómo se arma/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 1 · two examples plus the empty slot that is deliberately not fillable.
    await expect(dialog.getByText('Café Aurora')).toBeVisible();
    await expect(dialog.getByText('Tacos El Norte')).toBeVisible();
    await expect(dialog.getByText('El tuyo')).toBeVisible();

    await next(page);
    await expect(dialog.getByText('Sellos', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Cashback', { exact: true })).toBeVisible();

    await next(page); // 3 · the locked settings
    await expect(dialog.getByText('En el demo no se edita')).toBeVisible();

    await next(page); // 4 · the push
    await expect(dialog.getByText('Pantalla de bloqueo')).toBeVisible();

    await next(page); // 5 · the real card, and the way out
    await expect(dialog.getByRole('link', { name: /Comenzar ahora/ })).toHaveAttribute(
      'href',
      '/registro'
    );
  });

  test('switching the mechanic changes the card it ends on', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Ver cómo se arma/ }).click();
    const dialog = page.getByRole('dialog');

    // Café Aurora leads with stamps: the finished card talks about cafés.
    await next(page);
    await next(page);
    await next(page);
    await next(page);
    await expect(dialog.getByText(/Te faltan .* cafés/)).toBeVisible();

    // Same business, cashback instead: a balance, no stamps grid. This is the
    // whole argument of the demo — one product, two mechanics.
    for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: /Atrás/ }).click();
    await dialog.getByRole('button', { name: /Cashback/ }).click();
    await next(page);
    await next(page);
    await next(page);
    await expect(dialog.getByText('$180.00')).toBeVisible();
    await expect(dialog.getByText(/Te faltan .* cafés/)).toBeHidden();
  });

  test('closes with Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Ver cómo se arma/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
