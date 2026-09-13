/**
 * What the brand-asset uploader accepts, in one place.
 *
 * The limits lived in `app/api/upload/route.ts` while the file pickers spelled
 * their own `accept` strings by hand, and the two had already drifted: the
 * photo picker said `image/*`, which offers an owner every HEIC on their Mac —
 * and every photo an iPhone takes is HEIC — for the server to then refuse.
 * Narrower is fine, wider is a rejection the owner could not have predicted.
 *
 * Import-free so the browser and the route can share it.
 */

export const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Everything the route will store. `sharp` decodes all four. */
export const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

/**
 * A stamp icon is drawn straight onto the card's ground colour, so it has to
 * carry its own transparency. A JPEG has none and ships a white rectangle
 * around the mark — on a brand-coloured or dark card that is unmissable, and
 * the owner has no way to know why. WEBP can carry alpha but usually does not
 * when exported from the tools an owner has, so it is left out too.
 */
export const ICON_TYPES = ['image/png', 'image/svg+xml'] as const;

/** A photo of the place. SVG is excluded — it is not what a camera produces. */
export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** A logo may legitimately be any of them; vector is best. */
export const LOGO_TYPES = UPLOAD_TYPES;

/** The `accept` attribute for a file input. */
export function acceptAttr(types: readonly string[]): string {
  return types.join(',');
}

const NAMES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WEBP',
  'image/svg+xml': 'SVG',
};

/** "PNG, JPG o SVG" — what to actually show a person. */
export function formatNames(types: readonly string[]): string {
  const names = types.map((t) => NAMES[t] ?? t);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} o ${names[names.length - 1]}`;
}

/** The one-line hint under a file picker. */
export function uploadHint(types: readonly string[]): string {
  return `${formatNames(types)} · máx. ${MAX_UPLOAD_MB} MB`;
}
