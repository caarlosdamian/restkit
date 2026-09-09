import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appUrl } from '@/lib/app-url';

/**
 * This value ends up inside QR codes on printed posters and inside signed
 * wallet passes that cannot be edited afterwards. Getting it wrong is not a
 * rendering glitch — it is paper on a table pointing at the wrong host.
 */
describe('the origin everything outward-facing hangs off', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.APP_URL;
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it('takes APP_URL over anything Vercel supplies', () => {
    process.env.APP_URL = 'https://www.restaurantkit.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'old-project.vercel.app';
    expect(appUrl()).toBe('https://www.restaurantkit.app');
  });

  it('accepts a host typed without a scheme, and never keeps a trailing slash', () => {
    // Both are what someone actually pastes into a Vercel env field, and a
    // double slash in a QR is a redirect on every scan at best.
    process.env.APP_URL = 'www.restaurantkit.app';
    expect(appUrl()).toBe('https://www.restaurantkit.app');
    process.env.APP_URL = 'https://www.restaurantkit.app/';
    expect(appUrl()).toBe('https://www.restaurantkit.app');
  });

  it('prefers the project’s production domain over this deployment’s URL', () => {
    // A preview build must not mint passes pointing at a preview host that is
    // gone in a week — the pass outlives the deployment that issued it.
    process.env.VERCEL = '1';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'www.restaurantkit.app';
    process.env.VERCEL_URL = 'restkit-git-branch-abc123.vercel.app';
    expect(appUrl()).toBe('https://www.restaurantkit.app');
  });

  it('falls back to localhost only off Vercel', () => {
    expect(appUrl()).toBe('http://localhost:3000');
  });
});
