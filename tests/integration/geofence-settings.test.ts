import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import { DEFAULT_LOYALTY, loyaltyConfig } from '@/lib/loyalty';
import { passLocations } from '@/lib/apple-pass';

import { PATCH as saveSettings } from '@/app/api/settings/route';

/**
 * Setting and — the part that used to be impossible — REMOVING the geofence.
 *
 * A wrong pin fails in total silence: the card simply never appears on anybody's
 * lock screen, and nothing in the product reports it. The wallet form had no way
 * to clear one, so this covers the round trip the "Quitar ubicación" button
 * depends on, including the bit that is easy to get wrong — `undefined` has to
 * survive `JSON.stringify` and a `$set` as an actual removal.
 */

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

const PIN = { latitude: 19.4326077, longitude: -99.133208 };

async function seed() {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: { loyalty: DEFAULT_LOYALTY },
  });
  signInAs(businessId, 'OWNER');
  return businessId;
}

const save = (loyalty: Record<string, unknown>) =>
  saveSettings(jsonRequest('/api/settings', { method: 'PATCH', body: { settings: { loyalty } } }));

describe('the geofence round trip', () => {
  it('stores a pin and puts it on the pass', async () => {
    const businessId = await seed();

    const res = await save({ ...DEFAULT_LOYALTY, location: { ...PIN, maxDistance: 75 } });
    expect(res.status).toBe(200);

    const business = await Business.findById(businessId);
    const config = loyaltyConfig(business);
    expect(config.location?.latitude).toBeCloseTo(PIN.latitude, 6);

    const { locations } = passLocations(config, { progress: '3 de 10' });
    expect(locations).toHaveLength(1);
    expect(locations![0].maxDistance).toBe(75);
  });

  it('⚠️ actually removes the pin when the location is dropped', async () => {
    const businessId = await seed();
    await save({ ...DEFAULT_LOYALTY, location: { ...PIN, maxDistance: 75 } });

    // What the form sends after "Quitar ubicación": the key is simply absent,
    // because JSON.stringify drops `undefined`. If `$set` merged instead of
    // replacing, the old pin would survive and ship on every pass forever.
    const { ...withoutLocation } = DEFAULT_LOYALTY;
    const res = await save(withoutLocation);
    expect(res.status).toBe(200);

    const business = await Business.findById(businessId);
    const config = loyaltyConfig(business);
    expect(config.location?.latitude ?? null).toBeNull();
    // And the pass stops carrying one at all, rather than carrying an empty.
    expect(passLocations(config, { progress: '3 de 10' })).toEqual({});
  });

  it('leaves maxDistance off the pass when the owner picks "Automático"', async () => {
    // ⚠️ An absent radius is NOT zero — a maxDistance of 0 is a geofence
    // nothing can ever enter. "Automático" means let iOS choose.
    const businessId = await seed();
    await save({ ...DEFAULT_LOYALTY, location: { ...PIN } });

    const business = await Business.findById(businessId);
    const config = loyaltyConfig(business);
    const { locations } = passLocations(config, { progress: '3 de 10' });
    expect(locations![0]).not.toHaveProperty('maxDistance');
  });
});

describe('the custom stamp icon', () => {
  it('⚠️ can actually be removed, and the gallery icon takes over again', async () => {
    const businessId = await seed();

    // Uploaded: it overrides whatever the gallery says (strip-render.ts checks
    // customIconUrl first and never looks at stampIcon when it is set).
    await save({
      ...DEFAULT_LOYALTY,
      card: { ...DEFAULT_LOYALTY.card, stampIcon: 'coffee', customIconUrl: 'https://cdn.test/mi-icono.png' },
    });
    let business = await Business.findById(businessId);
    expect(loyaltyConfig(business).card.customIconUrl).toBe('https://cdn.test/mi-icono.png');

    // What the form sends after "Quitar": the key is simply gone, because
    // JSON.stringify drops `undefined`. If that did not survive the `$set`, an
    // uploaded icon would be permanent — which is exactly what it used to be.
    await save({
      ...DEFAULT_LOYALTY,
      card: { ...DEFAULT_LOYALTY.card, stampIcon: 'coffee' },
    });
    business = await Business.findById(businessId);
    const config = loyaltyConfig(business);
    expect(config.card.customIconUrl ?? null).toBeNull();
    // And the catalogue choice is back in force rather than a stale default.
    expect(config.card.stampIcon).toBe('coffee');
  });

  it('keeps the gallery choice while a custom icon is overriding it', async () => {
    // Picking from the gallery clears the upload in the form, but a config that
    // still carries both must not lose the stampIcon — removing the upload is
    // what brings it back, so it has to survive the round trip.
    const businessId = await seed();
    await save({
      ...DEFAULT_LOYALTY,
      card: { ...DEFAULT_LOYALTY.card, stampIcon: 'padel', customIconUrl: 'https://cdn.test/x.png' },
    });
    const business = await Business.findById(businessId);
    expect(loyaltyConfig(business).card.stampIcon).toBe('padel');
  });
});
