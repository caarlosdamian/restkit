/**
 * Shared constants for the E2E suite. The database is recreated on every run
 * (see server.mjs), so fixed credentials are safe and keep specs readable.
 */
export const OWNER = {
  businessName: 'La Terraza E2E',
  name: 'Dueño E2E',
  email: 'owner@e2e.local',
  password: 'Sup3rSecreta!',
};

/** A second, never-seeded business — used to test the fresh-database path. */
export const FRESH_OWNER = {
  businessName: 'Cocina Fresca E2E',
  name: 'Dueña Fresca E2E',
  email: 'fresh-owner@e2e.local',
  password: 'Sup3rSecreta!',
};

/** better-auth session persisted by global.setup.ts and reused by specs. */
export const OWNER_STATE = 'e2e/.auth/owner.json';

/**
 * Display-only POS marker (mirrors what POSLoginPage caches after login).
 * Authorization always comes from the session cookie — this only satisfies
 * the client-side gate on /pos/* pages.
 */
export const POS_MARKER = JSON.stringify({
  employeeName: OWNER.name,
  role: 'OWNER',
  businessId: '',
});

/**
 * Register a brand-new business and end up signed in.
 *
 * ⚠️ Registration no longer signs anyone in. `requireEmailVerification` means
 * /registro finishes on "revisa tu correo" and sign-in is refused until the
 * emailed link is opened, so every spec that registers its own owner has to
 * confirm the address and then log in. Kept here because three of them do, and
 * three copies of this would drift the first time the flow changed again.
 *
 * The confirmation link itself is exercised for real against better-auth in
 * tests/integration/signup-verification.test.ts — walking it here would make
 * every E2E run depend on parsing an email.
 */
export async function registerAndSignIn(
  page: import('@playwright/test').Page,
  account: { businessName: string; name: string; email: string; password: string }
): Promise<void> {
  const { markEmailVerified } = await import('./seed');

  await page.goto('/registro');
  await page.locator('#businessName').fill(account.businessName);
  await page.locator('#name').fill(account.name);
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.locator('button[type="submit"]').click();

  await page.getByText('Revisa tu correo').waitFor({ timeout: 60_000 });
  await markEmailVerified(account.email);

  await page.goto('/login');
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 60_000 });
}
