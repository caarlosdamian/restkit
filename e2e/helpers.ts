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
