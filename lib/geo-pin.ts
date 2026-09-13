/**
 * Reading a map pin out of whatever an owner pastes.
 *
 * The wallet form's only way to set a geofence used to be "usar mi ubicación
 * actual", which silently pins the card to wherever the owner is standing —
 * and people do admin from home. This exists so the pin can be set from a
 * Google Maps link, which is the one way a restaurant owner already knows how
 * to refer to their own address.
 *
 * Pure and import-free so it can be unit tested and used from the browser.
 */

export interface GeoPin {
  latitude: number;
  longitude: number;
}

export type PinFailure =
  /** A goo.gl / maps.app.goo.gl link. The coordinates are on the other side of
   *  a redirect we cannot follow from the browser, so the owner has to open it
   *  first. Its own case because "no pude leerlo" would send them in circles. */
  | 'SHORT_LINK'
  /** Nothing that looks like a coordinate pair. */
  | 'NO_COORDS'
  /** Found a pair, but it is not a place on Earth. */
  | 'OUT_OF_RANGE';

export type PinResult = { ok: true; pin: GeoPin } | { ok: false; reason: PinFailure };

const LAT_MAX = 90;
const LNG_MAX = 180;

function valid(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > LAT_MAX || Math.abs(lng) > LNG_MAX) return false;
  // Exactly (0, 0) is a real point in the Atlantic and never a Mexican
  // business. It is what a half-failed parse produces, and a silently wrong pin
  // is the thing this module exists to prevent.
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Pull coordinates out of a pasted Google/Apple Maps link, or a bare pair.
 *
 * ⚠️ Order matters. A Google place URL carries the coordinates TWICE: `@lat,lng`
 * is where the map camera sits, and `!3d<lat>!4d<lng>` inside `data=` is the
 * pin itself. They differ whenever the view was dragged or zoomed before
 * copying, so the pin wins — taking the camera would put the geofence up the
 * street from the restaurant, which is exactly the failure that is hard to
 * notice afterwards.
 */
export function parsePin(input: string): PinResult {
  const text = (input ?? '').trim();
  if (!text) return { ok: false, reason: 'NO_COORDS' };

  if (/(?:^|\/\/|\.)(?:goo\.gl|maps\.app\.goo\.gl)\//i.test(text)) {
    return { ok: false, reason: 'SHORT_LINK' };
  }

  // 1. The place pin inside a Google `data=` blob.
  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) {
    const lat = Number(pin[1]);
    const lng = Number(pin[2]);
    if (valid(lat, lng)) return { ok: true, pin: { latitude: lat, longitude: lng } };
    return { ok: false, reason: 'OUT_OF_RANGE' };
  }

  // 2. Google's camera position, Apple's `?ll=`, a `?q=` pair, or a bare pair
  //    typed by hand. All the same shape once the prefix is stripped.
  const pair =
    text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    text.match(/[?&](?:ll|q|sll|daddr)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i) ??
    text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);

  if (!pair) return { ok: false, reason: 'NO_COORDS' };

  const lat = Number(pair[1]);
  const lng = Number(pair[2]);
  if (!valid(lat, lng)) return { ok: false, reason: 'OUT_OF_RANGE' };
  return { ok: true, pin: { latitude: lat, longitude: lng } };
}

/** Where to send an owner to check the pin is actually on their business. */
export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Six decimals is ~11 cm. More is noise, and the raw float reads as broken. */
export function formatPin(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
