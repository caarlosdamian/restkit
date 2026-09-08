import type { CardGround } from '@/models/Business';

/**
 * Every colour decision the loyalty card makes, with no rendering attached.
 *
 * It lives apart from lib/strip-render.ts because that module imports sharp,
 * which cannot be bundled into a browser component — and the wallet form has
 * to show the owner the same grounds and inks the server will draw. One
 * source of truth, no drift between the picker and the card.
 */

/* --------------------------------------------------------------- colour */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '').replace('#', '').padEnd(6, '0').slice(0, 6);
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** HSL saturation, 0..1. */
export function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/* ------------------------------------------------------ contrast safety */

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** WCAG relative luminance. */
export function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG 1.4.11 asks 3:1 for a graphical object. Stamps are the graphic. */
export const MIN_CONTRAST = 3;

/**
 * Darkens a colour until it reads against the card ground, keeping its hue.
 *
 * Stamps are drawn as strokes in the brand colour on a light strip, so a pale
 * brand — yellow, pastel, white — rendered earned stamps that were invisible.
 * Preserving the hue keeps the card recognisably the business's own.
 */
export function readableInk(hex: string, background = '#ffffff'): string {
  if (contrastRatio(hex, background) >= MIN_CONTRAST) return hex;

  const [r, g, b] = hexToRgb(hex);
  const [h, s] = rgbToHsl(r, g, b);

  // A dark ground needs LIGHTER ink, not darker. Getting this backwards is why
  // stamps vanished into an uploaded photo: they were inked for white.
  const darkGround = relLuminance(background) < 0.4;

  // White, grey and black have no meaningful hue — boosting saturation would
  // invent one (white came out red). Neutral ink is the honest answer.
  if (s < 0.08) return darkGround ? '#f2f5f7' : '#3a4550';

  // A washed-out hue needs some saturation back, or shifting just yields grey.
  const sat = Math.max(s, 0.35);

  const steps = darkGround
    ? [0.62, 0.68, 0.74, 0.8, 0.86, 0.92]
    : [0.5, 0.44, 0.38, 0.32, 0.26, 0.2, 0.14];

  for (const l of steps) {
    const candidate = hslToHex(h, sat, l);
    if (contrastRatio(candidate, background) >= MIN_CONTRAST) return candidate;
  }
  return darkGround ? '#ffffff' : '#1b2430';
}

/**
 * Earned stamps take the brand colour, pending ones go grey. That fails for a
 * business whose brand is already grey — grey on grey is no difference at all —
 * so a low-saturation brand falls back to an outlined pending stamp instead.
 */
export const LOW_SATURATION = 0.18;
export const PENDING_GREY = '#b6bcc4';

export function stampPalette(brandColor: string, background = '#ffffff') {
  const flat = saturation(brandColor) < LOW_SATURATION;
  // Pale grey pending stamps disappear on a dark photo just as surely as dark
  // ones do, so the "not yet earned" colour follows the ground as well.
  const pendingInk = relLuminance(background) < 0.4 ? '#ffffff' : PENDING_GREY;
  return {
    // Never the raw brand colour: a pale brand drew invisible stamps.
    earned: readableInk(brandColor, background),
    pending: flat ? 'none' : pendingInk,
    pendingStroke: flat ? pendingInk : 'none',
    outlinePending: flat,
    darkGround: relLuminance(background) < 0.4,
  };
}

/* --------------------------------------------------------------- ground */

/**
 * What the stamps actually sit on.
 *
 * Every colour on the card is derived from this one value, so a card is never
 * assembled from a ground picked for one reason and ink picked for another —
 * which is how white stamps ended up on a white strip.
 *
 * A photo wins over the setting: the owner uploaded a picture of their place
 * because they want to see it, and its measured average is the honest ground.
 */
export function groundFor(
  ground: CardGround | undefined,
  brandColor: string,
  photoHex?: string
): string {
  if (photoHex) return photoHex;
  if (ground === 'brand') return brandColor;
  if (ground === 'dark') {
    const [h, s] = rgbToHsl(...hexToRgb(brandColor));
    // Keep the hue so a "dark" card still belongs to the business — a navy for
    // a blue brand, an espresso for an orange one — rather than generic black.
    return s < 0.08 ? '#1b2430' : hslToHex(h, Math.min(Math.max(s, 0.3), 0.55), 0.14);
  }
  return '#ffffff';
}
