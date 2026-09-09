import type Sharp from 'sharp';
import path from 'path';
import { existsSync } from 'fs';

/**
 * The one place sharp is loaded, and the fontconfig setup that has to happen
 * before it is. Both the card renderer and the upload path need it, and both
 * need it lazily — see below.
 */

/** The image renderer could not be loaded at all — a broken deployment, not a
 *  bad request. Separated from a render failure so a route can say which. */
export class ImageRenderUnavailableError extends Error {
  readonly code = 'IMAGE_RENDER_UNAVAILABLE';
  constructor(cause: unknown) {
    super(`No se pudo cargar el renderizador de imágenes: ${(cause as Error)?.message ?? cause}`);
  }
}

/**
 * sharp is loaded on demand, never at module scope.
 *
 * It is a native binding, and the one thing it does on a bad deployment is
 * fail to load — which, as a top-level import, took the whole route module
 * down with it. Every handler in the file then answered 500 before running a
 * line of its own: `/api/passes/strip/<garbage>` returned 500 instead of 404,
 * and the dashboard preview got an HTML error page inside an <img>, so the
 * owner saw a broken-image icon and nothing else. Loading it here keeps the
 * failure inside the one call that needs it.
 *
 * (What broke: sharp 0.35.x cannot resolve its libvips binary in a Turbopack
 * build on Vercel — see the pin in package.json.)
 */
let sharpModule: typeof Sharp | null = null;
export async function loadSharp(): Promise<typeof Sharp> {
  if (sharpModule) return sharpModule;
  configureCardFonts();
  try {
    sharpModule = (await import('sharp')).default;
    return sharpModule;
  } catch (err) {
    throw new ImageRenderUnavailableError(err);
  }
}

/**
 * Point fontconfig at the fonts we ship.
 *
 * ⚠️ **Vercel's runtime has no fonts installed — not even a generic
 * `sans-serif`.** librsvg drew every character of the strip as a .notdef box:
 * the stamps were perfect (they're paths) and every word on the card was tofu.
 * A developer machine hides this completely, because macOS has Helvetica.
 *
 * Must run BEFORE sharp is imported: libvips initialises fontconfig when it
 * loads, and the environment is read once. That ordering is the only reason
 * this lives next to `loadSharp` instead of in the routes.
 */
export function configureCardFonts(): void {
  // An explicitly configured environment wins — a container that mounted its
  // own font set should not be overridden by ours.
  if (process.env.FONTCONFIG_PATH) return;
  const dir = path.join(process.cwd(), 'assets', 'fonts');
  if (!existsSync(path.join(dir, 'fonts.conf'))) {
    // Not fatal: the card still renders, it just renders in whatever the host
    // happens to have. Worth a line in the log, because on a host with nothing
    // this is the difference between text and boxes.
    console.warn(`Card fonts not found at ${dir} — text will use host fonts.`);
    return;
  }
  process.env.FONTCONFIG_PATH = dir;
}
