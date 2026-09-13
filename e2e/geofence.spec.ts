import { test, expect } from '@playwright/test';
import { OWNER_STATE } from './helpers';

/**
 * Setting the wallet geofence from /dashboard/settings/wallet.
 *
 * The pin decides whether a customer's card ever appears on their lock screen,
 * and a wrong one fails in complete silence — the card simply never shows, and
 * nothing in the product reports it. Until recently the ONLY way to set it was
 * "usar mi ubicación actual", which pins the card to wherever the owner happens
 * to be standing; people do admin from home.
 *
 * The parsing is unit tested (tests/unit/geo-pin.test.ts) and the round trip
 * through the database is integration tested (tests/integration/
 * geofence-settings.test.ts). What is left, and what this covers, is the wiring
 * in between: paste, apply, see it, check it, remove it.
 */
test.use({ storageState: OWNER_STATE });

const MAPS_LINK =
  'https://www.google.com/maps/place/Taqueria/@19.4100000,-99.1700000,17z/' +
  'data=!3m1!4b1!4m6!3m5!1s0x85d1ff!8m2!3d19.4326077!4d-99.1332080';

test.describe('Wallet geofence', () => {
  test('paste a Maps link → pin appears → remove it', async ({ page }) => {
    await page.goto('/dashboard/settings/wallet');
    const paste = page.locator('input[placeholder*="google.com/maps/place"]');
    await expect(paste).toBeVisible();

    // A short link cannot be resolved from the browser, and saying so is the
    // difference between the owner opening it and pasting the same thing twice.
    await paste.fill('https://maps.app.goo.gl/abc123');
    await page.getByRole('button', { name: 'Usar', exact: true }).click();
    await expect(page.getByText(/liga es corta/i)).toBeVisible();

    // The place pin, not the camera position: 19.4326, not 19.4100.
    await paste.fill(MAPS_LINK);
    await page.getByRole('button', { name: 'Usar', exact: true }).click();
    await expect(page.getByText('19.432608, -99.133208')).toBeVisible();

    // The only way an owner can tell the pin is on their door and not two
    // streets over.
    const verify = page.getByRole('link', { name: /Verificar en el mapa/ });
    await expect(verify).toHaveAttribute('href', /19\.4326077,-99\.133208/);

    // And it can be taken back off, which it could not before.
    await page.getByRole('button', { name: /Quitar ubicación/ }).click();
    await expect(page.getByText('19.432608, -99.133208')).toBeHidden();
  });
});
