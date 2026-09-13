import { describe, it, expect } from 'vitest';
import { parsePin, mapsUrl, formatPin } from '@/lib/geo-pin';

/**
 * The geofence decides whether a customer's card ever appears on their lock
 * screen, and a pin that is wrong by a block fails silently forever — nothing
 * in the product can tell an owner their card is not showing. So the parsing is
 * held tightly, especially the part that picks WHICH of a Google link's two
 * coordinate pairs to believe.
 */

const pin = (s: string) => {
  const r = parsePin(s);
  if (!r.ok) throw new Error(`expected a pin, got ${r.reason}`);
  return r.pin;
};
const reason = (s: string) => {
  const r = parsePin(s);
  if (r.ok) throw new Error('expected a failure');
  return r.reason;
};

describe('reading a pin out of a pasted link', () => {
  it('⚠️ prefers the place pin over the camera position', () => {
    // A Google place URL carries both. `@` is where the map was looking when
    // the link was copied; `!3d/!4d` is the pin on the business. They drift
    // apart the moment someone scrolls before copying, and taking the camera
    // would put the geofence up the street.
    const url =
      'https://www.google.com/maps/place/Taqueria+El+Califa/@19.4100000,-99.1700000,17z/' +
      'data=!3m1!4b1!4m6!3m5!1s0x85d1ff!8m2!3d19.4326077!4d-99.1332080!16s%2Fg%2F11c';
    expect(pin(url)).toEqual({ latitude: 19.4326077, longitude: -99.133208 });
  });

  it('falls back to the camera position when there is no place pin', () => {
    expect(pin('https://www.google.com/maps/@19.4326,-99.1332,17z')).toEqual({
      latitude: 19.4326,
      longitude: -99.1332,
    });
  });

  it('reads a ?q= and an Apple Maps ?ll=', () => {
    expect(pin('https://maps.google.com/?q=19.4326,-99.1332').latitude).toBe(19.4326);
    expect(pin('https://maps.apple.com/?ll=19.4326,-99.1332').longitude).toBe(-99.1332);
  });

  it('accepts a bare pair typed by hand, spaced or not', () => {
    expect(pin('19.4326,-99.1332')).toEqual({ latitude: 19.4326, longitude: -99.1332 });
    expect(pin('  19.4326 , -99.1332  ')).toEqual({ latitude: 19.4326, longitude: -99.1332 });
  });

  it('⚠️ tells a short link apart from unreadable junk', () => {
    // The coordinates are behind a redirect the browser cannot follow, so the
    // owner has to open it and copy the full URL. Reported as NO_COORDS they
    // would paste the same link again and again.
    expect(reason('https://maps.app.goo.gl/abc123')).toBe('SHORT_LINK');
    expect(reason('https://goo.gl/maps/abc123')).toBe('SHORT_LINK');
  });

  it('refuses a pair that is not a place on Earth', () => {
    expect(reason('95.0,-99.1332')).toBe('OUT_OF_RANGE');
    expect(reason('19.4326,-200.5')).toBe('OUT_OF_RANGE');
    // Null island: what a half-failed parse produces, never a real business.
    expect(reason('0,0')).toBe('OUT_OF_RANGE');
  });

  it('refuses what it cannot read, rather than guessing', () => {
    expect(reason('')).toBe('NO_COORDS');
    expect(reason('Av. Insurgentes Sur 123, CDMX')).toBe('NO_COORDS');
    expect(reason('https://www.google.com/maps/place/Taqueria')).toBe('NO_COORDS');
  });

  it('keeps a negative longitude, which is all of Mexico', () => {
    expect(pin('https://www.google.com/maps/@25.6866,-100.3161,15z').longitude).toBeLessThan(0);
  });
});

describe('showing the pin back', () => {
  it('links somewhere an owner can actually check it', () => {
    expect(mapsUrl(19.4326, -99.1332)).toContain('19.4326,-99.1332');
  });

  it('rounds to something readable rather than a raw float', () => {
    expect(formatPin(19.43260774, -99.13320801)).toBe('19.432608, -99.133208');
  });
});
