import { test, expect } from '@playwright/test';
import { OWNER_STATE } from './helpers';

/**
 * Choosing the stamp icon in /dashboard/settings/wallet.
 *
 * ⚠️ An uploaded icon OVERRIDES the catalogue — `lib/strip-render.ts` checks
 * `customIconUrl` first and never looks at `stampIcon` when it is set. For a
 * while that made an upload permanent: there was no control to remove it, and
 * clicking a catalogue icon only changed a value the renderer ignores, while
 * the grid highlighted the new choice. The picker said one thing and the card
 * printed another, with no way back.
 *
 * Both exits are covered here because they are separate code paths, and the
 * first one is the one an owner reaches for without being told.
 */
test.use({ storageState: OWNER_STATE });

const ICON_INPUT = 'input[accept="image/png,image/svg+xml"]';
const FAKE_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iIzBmNzY2ZSIvPjwvc3ZnPg==';

test.describe('Stamp icon', () => {
  test.beforeEach(async ({ page }) => {
    // Stub the upload: this is about what the form does with the result, not
    // about storage, which has its own gate (503 STORAGE_NOT_CONFIGURED).
    await page.route('**/api/upload', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: FAKE_ICON, storage: 'blob' }),
      })
    );
    await page.goto('/dashboard/settings/wallet');
    await page.waitForLoadState('networkidle');
  });

  const uploadOne = (page: import('@playwright/test').Page) =>
    page.locator(ICON_INPUT).setInputFiles({
      name: 'icono.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-really-a-png'),
    });

  test('picking from the catalogue clears an uploaded icon', async ({ page }) => {
    const banner = page.getByText('Estás usando tu propio ícono');

    await uploadOne(page);
    await expect(banner).toBeVisible();

    // While an upload is in force, nothing in the grid may claim to be selected
    // — that ring was the lie that made the bug invisible.
    await page.locator('button[title="Café"]').first().click();
    await expect(banner).toBeHidden();
  });

  test('and the explicit Quitar button does too', async ({ page }) => {
    const banner = page.getByText('Estás usando tu propio ícono');

    await uploadOne(page);
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: /Quitar/ }).click();
    await expect(banner).toBeHidden();
  });
});
