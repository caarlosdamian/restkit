import { test, expect } from '@playwright/test';

/**
 * Changing the account password from /dashboard/settings.
 *
 * Deliberately runs on an account this spec registers itself, not on the shared
 * OWNER: the suite reuses one saved session across every other file, so a spec
 * that rotated that password would leave the rest of the run signed in with a
 * credential that no longer exists.
 */
const ACCOUNT = {
  businessName: 'Contraseñas E2E',
  name: 'Dueña Contraseña',
  email: `pw-${Date.now()}@e2e.local`,
  before: 'Sup3rSecreta!',
  after: 'Otr4Contrasena!',
};

test.use({ storageState: { cookies: [], origins: [] } });

test('an owner can change their password, and only the new one works', async ({ page }) => {
  await page.goto('/registro');
  await page.locator('#businessName').fill(ACCOUNT.businessName);
  await page.locator('#name').fill(ACCOUNT.name);
  await page.locator('#email').fill(ACCOUNT.email);
  await page.locator('#password').fill(ACCOUNT.before);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 60_000 });

  await page.goto('/dashboard/settings');
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Cambiar contraseña' }) });
  await expect(form).toBeVisible();
  // The section names the account being changed — on a shared terminal that is
  // the difference between changing your password and changing the manager's.
  await expect(form).toContainText(ACCOUNT.email);

  const submit = form.getByRole('button', { name: 'Cambiar contraseña' });
  const [currentField, nextField, confirmField] = [0, 1, 2].map((i) =>
    form.locator('input[type="password"]').nth(i)
  );

  // Nothing typed: there is no way to submit an empty change.
  await expect(submit).toBeDisabled();

  // A mismatch is caught before it reaches the server.
  await currentField.fill(ACCOUNT.before);
  await nextField.fill(ACCOUNT.after);
  await confirmField.fill('algo-distinto');
  await expect(form).toContainText('No coincide');
  await expect(submit).toBeDisabled();

  // The wrong current password is rejected, in Spanish, without clearing input.
  await confirmField.fill(ACCOUNT.after);
  await currentField.fill('no-es-esta');
  await submit.click();
  await expect(form).toContainText('La contraseña actual no es correcta');

  await currentField.fill(ACCOUNT.before);
  await submit.click();
  await expect(form).toContainText('Contraseña actualizada');

  // The real assertion: the credential actually moved.
  await page.goto('/login');
  await page.locator('#email').fill(ACCOUNT.email);
  await page.locator('#password').fill(ACCOUNT.before);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/dashboard$/, { timeout: 10_000 });

  await page.locator('#email').fill(ACCOUNT.email);
  await page.locator('#password').fill(ACCOUNT.after);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 60_000 });
});
