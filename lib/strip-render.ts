import type Sharp from 'sharp';
import path from 'path';
import { existsSync } from 'fs';
import { readAsset } from './storage';
import { findStampIcon, STAMP_STROKE } from './stamp-icons';
import { stampState, formatMXN } from './loyalty';
import type { ILoyaltyConfig, StampStyle } from '@/models/Business';

/**
 * Draws the strip image that sits across the middle of the Wallet card.
 *
 * Apple has no stamps widget — a storeCard gets an icon, a logo and a strip,
 * and that's the whole surface. So the punch card is an image we render per
 * customer and re-issue on every update, which is what makes the card visibly
 * fill up instead of showing the same picture at 1/10 and 9/10.
 *
 * The same function backs the live preview in the dashboard, so what an owner
 * designs is byte-identical to what ships.
 */

/** Apple's storeCard strip box at 1x. @2x and @3x are the same box scaled. */
export const STRIP_W = 375;
export const STRIP_H = 123;

export interface StripInput {
  currentVisits: number;
  cashbackBalance: number;
  config: ILoyaltyConfig;
  /** Falls back to the business's primaryColor. */
  brandColor: string;
  /** Optional photo of the place. Placement comes from `config.card`. */
  backgroundUrl?: string;
  /** Uploaded stamp icon, overriding the catalogue one. */
  customIconUrl?: string;
  scale?: 1 | 2 | 3;
}

import {
  contrastRatio,
  groundFor,
  LOW_SATURATION,
  readableInk,
  relLuminance,
  saturation,
} from './card-colors';

// Re-exported so the renderer stays the one import site for card drawing.
export {
  contrastRatio,
  groundFor,
  readableInk,
  saturation,
  stampPalette,
} from './card-colors';

/* ---------------------------------------------------------------- stamp */

interface StampGeom {
  cx: number;
  cy: number;
  /** Radius of the badge disc/ring, for `filled` and `outline`. */
  r: number;
  /** Side of the 24×24 icon box after scaling. */
  icon: number;
}

/**
 * Draws one stamp in the chosen style.
 *
 * `filled` is the punch-card look and the reason this function exists: a solid
 * disc with the icon knocked out of it in the ground colour reads across a
 * counter, where a hairline stroked glyph at 20px does not.
 *
 * An uploaded icon is a raster — it can't be knocked out of anything and it
 * carries its own colours — so it gets a plate behind it instead of a
 * knockout, and desaturates rather than re-inks when pending.
 */
function drawStamp(
  g: StampGeom,
  opts: {
    earned: boolean;
    style: StampStyle;
    ink: string;
    ground: string;
    iconPath: string;
    customIcon?: string;
    /** Grey brand: pending needs a shape, not a paler grey. */
    outlinePending: boolean;
  }
): string {
  const { earned, style, ink, ground, iconPath, customIcon } = opts;
  const size = style === 'plain' ? g.icon : g.r * 1.15;
  const x = (g.cx - size / 2).toFixed(2);
  const y = (g.cy - size / 2).toFixed(2);
  const scale = (size / 24).toFixed(4);

  const glyph = (stroke: string, opacity?: number) =>
    `<g transform="translate(${x} ${y}) scale(${scale})"${
      opacity != null ? ` opacity="${opacity}"` : ''
    }><path d="${iconPath}" fill="none" stroke="${stroke}" stroke-width="${STAMP_STROKE}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></g>`;

  const image = (opacity: number, faded: boolean) =>
    `<image href="${customIcon}" x="${x}" y="${y}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" ` +
    `preserveAspectRatio="xMidYMid meet" opacity="${opacity}"${faded ? ' filter="url(#faded)"' : ''}/>`;

  const disc = (fill: string, opacity: number) =>
    `<circle cx="${g.cx.toFixed(2)}" cy="${g.cy.toFixed(2)}" r="${g.r.toFixed(2)}" fill="${fill}" opacity="${opacity}"/>`;

  const ring = (stroke: string, opacity: number, width = 1.7) =>
    `<circle cx="${g.cx.toFixed(2)}" cy="${g.cy.toFixed(2)}" r="${g.r.toFixed(2)}" fill="none" ` +
    `stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`;

  if (style === 'filled') {
    if (customIcon) {
      // A plate, not a knockout: the image keeps its own colours either way.
      return earned
        ? disc(ink, 0.16) + image(1, false)
        : ring(ink, 0.3) + image(0.4, true);
    }
    return earned
      ? disc(ink, 1) + glyph(ground)
      : disc(ink, 0.12) + glyph(ink, 0.38);
  }

  if (style === 'outline') {
    if (customIcon) {
      return earned ? ring(ink, 0.9) + image(1, false) : ring(ink, 0.28) + image(0.4, true);
    }
    return earned
      ? ring(ink, 0.85) + glyph(ink)
      : ring(ink, 0.28) + glyph(ink, 0.32);
  }

  // plain
  if (customIcon) return earned ? image(1, false) : image(0.45, true);
  if (earned) return glyph(ink);
  // Grey brand: a paler grey is no difference at all, so pending gets a ring.
  if (opts.outlinePending) return ring(ink, 0.55, 1.6);
  return glyph(ink, 0.34);
}

/* --------------------------------------------------------------- layout */

/** Keeps rows balanced: 10 reads better as 5+5 than as 6+4. */
function gridFor(count: number): { cols: number; rows: number } {
  if (count <= 6) return { cols: count, rows: 1 };
  if (count <= 12) return { cols: Math.ceil(count / 2), rows: 2 };
  return { cols: Math.ceil(count / 3), rows: 3 };
}

/**
 * XML-escapes text for the SVG **and drops what the card font cannot draw.**
 *
 * The strings on this card are owner-typed — a reward description, the name of
 * a unit — and librsvg has no fallback chain to fall back to: whatever Geist
 * does not map is drawn as a .notdef box. So "🎉 Café gratis" would ship to
 * every customer's wallet as a box followed by the words. Geist covers all of
 * Latin-1 and the typographic marks (— … « » º ª ™ →), which is everything a
 * Mexican business actually types; what it lacks is emoji and dingbats.
 *
 * Verified against the font's own cmap, not by eye — see the note on ★ below.
 */
function esc(s: string): string {
  return s
    // Astral plane: every emoji lives here.
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    // Miscellaneous Symbols and Dingbats (★ ☕ ✔), plus the joiners that glue
    // emoji sequences together and would otherwise be left behind.
    .replace(/[\u2600-\u27BF\uFE0F\u200D]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Geist, the same face the dashboard uses, vendored under assets/fonts and
// wired up in `configureCardFonts` — a host font stack alone renders as boxes
// wherever the host has no fonts, which is every serverless runtime.
const FONT = 'Geist, Helvetica Neue, Helvetica, Arial, sans-serif';

/* ------------------------------------------------------------------ svg */

export function stripSvg(
  input: StripInput & { customIconDataUri?: string; groundHex?: string; photoInset?: number }
): string {
  const { config, brandColor } = input;
  const w = STRIP_W;
  const h = STRIP_H;

  // With the photo BESIDE the stamps, the stamps sit on the card ground, not
  // on the picture — so the photo's average must not drive the ink.
  const inset = input.photoInset ?? 0;
  const photoBehind = Boolean(input.backgroundUrl) && inset === 0;
  const ground = groundFor(config.card?.ground, brandColor, photoBehind ? input.groundHex : undefined);
  const onDark = relLuminance(ground) < 0.4;
  const ink = readableInk(brandColor, ground);
  // Text is not a graphical object — it wants the full contrast, not 3:1 — and
  // a caption tinted toward the brand on a brand ground reads as a smudge.
  const text = onDark ? '#ffffff' : '#141a21';
  // The winning caption is celebrated in the brand colour, but only where that
  // colour is actually legible. On a brand ground the ink IS a tint of the
  // ground, so "¡PREMIO LISTO!" in it disappeared into the card.
  const accentText = contrastRatio(ink, ground) >= 4.5 ? ink : text;

  // A photo can be busy as well as dark. A veil in the direction of the ink
  // gives the stamps something even to sit on while the picture shows through.
  const veil = photoBehind
    ? `<rect width="${w}" height="${h}" fill="${onDark ? '#000000' : '#ffffff'}" opacity="0.28"/>`
    : '';
  // The composited base already carries the ground and any photo band, so the
  // SVG must not paint over it.
  const base = input.backgroundUrl ? '' : `<rect width="${w}" height="${h}" fill="${ground}"/>`;

  if (config.mechanic === 'cashback') {
    const balance = input.cashbackBalance ?? 0;
    const threshold = config.cashback.threshold;
    const short = Math.max(0, threshold - balance);
    const ready = short <= 0;
    const pct = threshold > 0 ? Math.min(1, balance / threshold) : 1;

    // Two columns, the way a statement reads: what you have, and what you earn
    // on the next purchase. The old strip showed the balance alone, which told
    // a customer nothing about why it was growing.
    const barY = 92;
    // The photo band eats into the LEFT edge only; anchoring the right column
    // to `w - barX` moved it inward too and stacked the two columns on top of
    // each other.
    const barX = inset + 22;
    const barRight = w - 22;
    const barW = barRight - barX;
    // Less room to work in once a photo takes a third of the band.
    const big = inset > 0 ? 27 : 34;
    const rateSize = inset > 0 ? 23 : 29;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${base}
  ${veil}
  <text x="${barX}" y="34" font-family="${FONT}" font-size="10" font-weight="700"
        letter-spacing="1.5" fill="${text}" opacity="0.62">SALDO</text>
  <text x="${barX}" y="72" font-family="${FONT}" font-size="${big}" font-weight="700"
        fill="${text}">${esc(formatMXN(balance))}</text>
  <text x="${barRight}" y="34" text-anchor="end" font-family="${FONT}" font-size="10" font-weight="700"
        letter-spacing="1.5" fill="${text}" opacity="0.62">DEVUELVE</text>
  <text x="${barRight}" y="70" text-anchor="end" font-family="${FONT}" font-size="${rateSize}" font-weight="700"
        fill="${ink}">${esc(`${config.cashback.rate}%`)}</text>
  <rect x="${barX}" y="${barY}" width="${barW}" height="5" rx="2.5" fill="${text}" opacity="0.16"/>
  <rect x="${barX}" y="${barY}" width="${(barW * pct).toFixed(1)}" height="5" rx="2.5" fill="${ink}"/>
  <text x="${barX}" y="${h - 10}" font-family="${FONT}" font-size="${inset > 0 ? 10 : 11}" font-weight="${ready ? '700' : '500'}"
        fill="${text}" opacity="${ready ? '1' : '0.75'}">${esc(
          ready ? 'Tu saldo está listo para usarse' : `Te faltan ${formatMXN(short)} para usarlo`
        )}</text>
</svg>`;
  }

  const required = config.sellos.required;
  const state = stampState(input.currentVisits, required);
  const style: StampStyle = config.card?.stampStyle ?? 'filled';
  const icon = findStampIcon(config.card.stampIcon);
  const custom = input.customIconDataUri;
  const { cols, rows } = gridFor(required);

  // Fit the grid inside the strip with room for the caption underneath.
  const captionH = 22;
  const usableH = h - captionH;
  // `inset` is the band the photo has taken on the left; everything else lays
  // out inside what is left, so the stamps are never drawn under the picture.
  const regionX = inset;
  const regionW = w - inset;
  const cell = Math.min((regionW - 28) / cols, (usableH - 12) / rows);
  const gridW = cols * cell;
  const gridH = rows * cell;
  const originX = regionX + (regionW - gridW) / 2;
  const originY = (usableH - gridH) / 2;

  const outlinePending = saturation(brandColor) < LOW_SATURATION;

  const stamps: string[] = [];
  for (let i = 0; i < required; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    stamps.push(
      drawStamp(
        {
          cx: originX + col * cell + cell / 2,
          cy: originY + row * cell + cell / 2,
          r: cell * 0.4,
          // Sized to sit at the same visual weight as a badge, which is a
          // smaller box than the badge's own diameter — a bare glyph reads
          // bigger than a disc of the same width.
          icon: cell * 0.62,
        },
        {
          earned: i < state.stamps,
          style,
          ink,
          ground,
          iconPath: icon.d,
          customIcon: custom,
          outlinePending,
        }
      )
    );
  }

  // NOT the count. Both wallets already print "4 de 10" in a field beside the
  // strip, so repeating it here spent the one line of copy on the card saying
  // something the customer had just read. The distance to the reward is the
  // thing they actually want to know, and the stamps above are countable.
  const left = Math.max(0, required - state.stamps);
  const unit = left === 1 ? config.sellos.unitSingular : config.sellos.unitPlural;
  const caption = state.cardFull
    // No ★ here, however much it wants one: Geist has no U+2605 and librsvg
    // drew it as a hex box on the card. The line is bold and in the accent
    // colour when it matters, which is the emphasis the star was for.
    ? `¡PREMIO LISTO! · ${config.sellos.rewardDescription}`
    : `${left === 1 ? 'Te falta' : 'Te faltan'} ${left} ${unit} para tu premio`;

  // Over a photo a scrim keeps the caption readable whatever the picture is,
  // and it matches the ink: white text needs a dark band, not a light one.
  const scrim = photoBehind
    ? `<rect x="0" y="${h - 24}" width="${w}" height="24" fill="${onDark ? '#000000' : '#ffffff'}" opacity="0.55"/>`
    : '';

  const defs = custom
    ? `<defs><filter id="faded"><feColorMatrix type="saturate" values="0"/></filter></defs>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${defs}
  ${base}
  ${veil}
  ${state.cardFull ? `<rect x="${regionX}" y="0" width="${regionW}" height="${h}" fill="${ink}" opacity="0.10"/>` : ''}
  ${stamps.join('\n  ')}
  ${scrim}
  <text x="${regionX + regionW / 2}" y="${h - 7}" text-anchor="middle" font-family="${FONT}"
        font-size="12" font-weight="${state.cardFull ? '700' : '500'}" fill="${
          state.cardFull ? accentText : text
        }">${esc(caption)}</text>
</svg>`;
}

/* ------------------------------------------------------------------ png */

/** Local assets come off disk, remote ones over the wire — see readAsset. */
const fetchImage = readAsset;

/** How much of the strip a side-by-side photo takes. Enough to read as a
 *  picture of the place, not so much that a 10-stamp grid stops fitting. */
export const SIDE_PHOTO_FRACTION = 0.36;

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
async function loadSharp(): Promise<typeof Sharp> {
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
function configureCardFonts(): void {
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

/** Renders the strip to a PNG at the requested scale. */
export async function renderStrip(input: StripInput): Promise<Buffer> {
  const sharp = await loadSharp();
  const scale = input.scale ?? 1;
  const w = STRIP_W * scale;
  const h = STRIP_H * scale;

  // sharp's SVG renderer will not fetch remote hrefs, so an uploaded icon has
  // to be inlined as a data URI before the SVG is handed over.
  let customIconDataUri: string | undefined;
  if (input.customIconUrl) {
    const bytes = await fetchImage(input.customIconUrl);
    if (bytes) {
      const png = await sharp(bytes)
        .resize(96, 96, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      customIconDataUri = `data:image/png;base64,${png.toString('base64')}`;
    }
  }

  // `footer` puts the photo in a band of its own, outside the strip entirely —
  // rendered by the web card and by Google's image module, not here.
  const placement = input.config.card?.photoPlacement ?? 'background';
  const wantsPhoto = Boolean(input.backgroundUrl) && placement !== 'footer';
  const bg = wantsPhoto ? await fetchImage(input.backgroundUrl as string) : null;

  let base: Buffer | null = null;
  let groundHex: string | undefined;
  let photoInset = 0;

  if (bg && placement === 'side') {
    // The photo takes a band on the left and the card ground fills the rest,
    // so the stamps keep a flat, predictable surface to sit on. This is the
    // only way to show a photo AND the stamps on an Apple storeCard: the strip
    // is the one image slot the format has.
    try {
      const bandW = Math.round(w * SIDE_PHOTO_FRACTION);
      const band = await sharp(bg)
        .resize(bandW, h, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      const ground = groundFor(
        input.config.card?.ground,
        input.brandColor
      ).replace('#', '');
      base = await sharp({
        create: {
          width: w,
          height: h,
          channels: 4,
          background: `#${ground}`,
        },
      })
        .composite([{ input: band, left: 0, top: 0 }])
        .png()
        .toBuffer();
      photoInset = bandW / scale;
    } catch (err) {
      console.error('Strip side-photo composite failed:', err);
      base = null;
    }
  } else if (bg) {
    // Measure the photo before drawing: the stamps have to be inked for the
    // ground they'll actually sit on, not for the white card they'd sit on
    // without one.
    try {
      base = await sharp(bg).resize(w, h, { fit: 'cover', position: 'centre' }).png().toBuffer();
      const { channels } = await sharp(base).stats();
      const [r, g, b] = channels.slice(0, 3).map((c) => Math.round(c.mean));
      groundHex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    } catch (err) {
      console.error('Strip background analysis failed:', err);
      base = null;
    }
  }

  const svg = Buffer.from(
    stripSvg({
      ...input,
      customIconDataUri,
      groundHex,
      photoInset,
      backgroundUrl: base ? input.backgroundUrl : undefined,
    })
  );
  const overlay = await sharp(svg).resize(w, h).png().toBuffer();

  if (!base) return overlay;

  try {
    return await sharp(base).composite([{ input: overlay, blend: 'over' }]).png().toBuffer();
  } catch (err) {
    console.error('Strip composite failed:', err);
    return overlay;
  }
}

/** All three variants Apple wants in one pass. */
export async function renderStripVariants(
  input: StripInput
): Promise<{ '1x': Buffer; '2x': Buffer; '3x': Buffer }> {
  const [x1, x2, x3] = await Promise.all([
    renderStrip({ ...input, scale: 1 }),
    renderStrip({ ...input, scale: 2 }),
    renderStrip({ ...input, scale: 3 }),
  ]);
  return { '1x': x1, '2x': x2, '3x': x3 };
}
