import { PKPass } from 'passkit-generator';
import sharp from 'sharp';
import { solidColorPNG } from './png';
import { loyaltyConfig, stampState, formatMXN } from './loyalty';
import { buildCardLayout, fillTokens, withoutChangeMessages } from './card-layout';
import { groundFor, readableInk, relLuminance } from './card-colors';
import { renderStripVariants } from './strip-render';
import { findStampIcon } from './stamp-icons';
import type { ICustomer } from '@/models/Customer';
import type { IBusiness, ILoyaltyConfig } from '@/models/Business';
import { readAsset } from './storage';
import { appUrl } from './app-url';

// Apple's design guide caps the logo at 160x50pt (1x); @2x/@3x are the same
// box scaled up. `fit: 'inside'` preserves aspect ratio without cropping.
async function fetchLogoVariants(
  logoUrl: string
): Promise<{ '1x': Buffer; '2x': Buffer; '3x': Buffer } | null> {
  try {
    const input = await readAsset(logoUrl);
    if (!input) return null;
    const scaled = (scale: number) =>
      sharp(input)
        .resize({ width: 160 * scale, height: 50 * scale, fit: 'inside' })
        .png()
        .toBuffer();
    const [x1, x2, x3] = await Promise.all([scaled(1), scaled(2), scaled(3)]);
    return { '1x': x1, '2x': x2, '3x': x3 };
  } catch (err) {
    console.error('Apple pass logo fetch/convert failed:', err);
    return null;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').padEnd(6, '0');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function cssRgb(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** The pass icon is what the customer sees in the notification when a stamp
 *  lands, so it draws the business's own stamp mark rather than a flat square. */
async function iconVariants(
  iconId: string,
  bg: string
): Promise<{ 1: Buffer; 2: Buffer; 3: Buffer } | null> {
  try {
    const icon = findStampIcon(iconId);
    // White on the brand colour was invisible for a pale brand — and this icon
    // IS the notification a customer sees when a stamp lands, so it gets the
    // same contrast treatment as the stamps themselves.
    const stroke = relLuminance(bg) < 0.5 ? '#ffffff' : readableInk(bg, bg);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="87" height="87" viewBox="0 0 87 87">
  <rect width="87" height="87" rx="18" fill="${bg}"/>
  <g transform="translate(19.5 19.5) scale(2)">
    <path d="${icon.d}" fill="none" stroke="${stroke}" stroke-width="2.4"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
    const at = (px: number) => sharp(Buffer.from(svg)).resize(px, px).png().toBuffer();
    const [x1, x2, x3] = await Promise.all([at(29), at(58), at(87)]);
    return { 1: x1, 2: x2, 3: x3 };
  } catch (err) {
    console.error('Apple pass icon render failed:', err);
    return null;
  }
}

export interface PassLocation {
  latitude: number;
  longitude: number;
  relevantText: string;
  maxDistance?: number;
}

/**
 * The pass's geofence, or nothing when the owner never set one.
 *
 * ⚠️ This is not the push notification. It is a lock-screen pass
 * **suggestion**: a live state iOS maintains while it believes the pass is
 * useful where you are, cleared when you leave. It cannot be swiped away,
 * because swiping does not end the condition that put it there — which is why
 * an owner testing inside their own restaurant sees it permanently.
 *
 * Two things are ours to set. `relevantText` is plain text (Apple substitutes
 * nothing into it, unlike `changeMessage`), so `{progreso}` is filled in here
 * — the owner learns one token, not two rules. And `maxDistance` is the only
 * lever over how insistent it feels: leaving it unset hands iOS a roughly
 * 100m bubble, half a street for a café on a corner.
 */
export function passLocations(
  config: ILoyaltyConfig,
  values: { progress: string }
): { locations?: PassLocation[] } {
  const location = config.location;
  if (location?.latitude == null || location?.longitude == null) return {};

  const isCashback = config.mechanic === 'cashback';
  return {
    locations: [
      {
        latitude: location.latitude,
        longitude: location.longitude,
        relevantText: fillTokens(
          location.relevantText ?? '',
          values.progress,
          isCashback ? 'Tienes {progreso} de saldo' : `Llevas {progreso} ${config.sellos.unitPlural}`
        ),
        ...(location.maxDistance ? { maxDistance: location.maxDistance } : {}),
      },
    ],
  };
}

export interface ApplePassOptions {
  /**
   * Update the installed pass without telling the customer.
   *
   * For a decrease — a manager removing a purchase that was rung up twice.
   * The card must still become correct, but "Llevas 4 de 10" on a lock screen
   * is a question nobody behind the counter can answer. Before this existed the
   * only way to stay quiet was to skip the push, which left the iPhone showing
   * a stamp the customer no longer had, indefinitely: a storeCard never polls.
   */
  silent?: boolean;
}

export async function generateApplePass(
  customer: ICustomer,
  business: IBusiness,
  options: ApplePassOptions = {}
): Promise<Buffer> {
  const passTypeId = process.env.APPLE_PASS_TYPE_IDENTIFIER;
  const teamId = process.env.APPLE_TEAM_ID;
  const wwdrB64 = process.env.APPLE_WWDR_CERT_BASE64;
  const certB64 = process.env.APPLE_SIGNER_CERT_BASE64;
  const keyB64 = process.env.APPLE_SIGNER_KEY_BASE64;

  if (!passTypeId || !teamId || !wwdrB64 || !certB64 || !keyB64) {
    throw new Error(
      'Apple Wallet env vars not configured. Set APPLE_PASS_TYPE_IDENTIFIER, APPLE_TEAM_ID, APPLE_WWDR_CERT_BASE64, APPLE_SIGNER_CERT_BASE64, APPLE_SIGNER_KEY_BASE64.'
    );
  }

  const base = appUrl();
  const primaryColor = business.branding?.primaryColor || '#4f46e5';

  const serialNumber = (customer._id as { toString(): string }).toString();
  // Falling back to the serial would mint a pass whose token can never match
  // what the web service checks — permanently un-updatable. Fail loudly instead.
  const authToken = customer.externalIds?.appleAuthToken;
  if (!authToken) {
    throw new Error(
      `Customer ${serialNumber} has no appleAuthToken; refusing to issue an un-updatable pass.`
    );
  }

  const { currentVisits } = customer.stats;
  const config = loyaltyConfig(business);
  const required = config.sellos.required;
  const state = stampState(currentVisits, required);
  const isCashback = config.mechanic === 'cashback';

  // The pass chrome takes the SAME ground the strip is drawn on, so the card
  // reads as one object. Painting the pass in the raw brand colour while the
  // strip sat on white put a hard seam across the middle of every card.
  const cardGround = groundFor(config.card.ground, primaryColor);
  const [r, g, b] = hexToRgb(cardGround);
  const onDark = relLuminance(cardGround) < 0.4;
  const fg = onDark ? cssRgb(255, 255, 255) : cssRgb(20, 26, 33);
  const label = onDark ? cssRgb(214, 219, 224) : cssRgb(94, 104, 116);

  const layout = buildCardLayout(
    {
      businessName: business.name,
      config,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        createdAt: (customer as { createdAt?: Date }).createdAt,
        stats: customer.stats,
      },
      // A storeCard always ships a strip here, so primaryFields stay empty.
      hasStrip: true,
    },
    config.card.fields
  );

  // A silent update ships the same values with none of the announcements.
  const fields = options.silent
    ? {
        header: withoutChangeMessages(layout.header),
        secondary: withoutChangeMessages(layout.secondary),
        auxiliary: withoutChangeMessages(layout.auxiliary),
        back: withoutChangeMessages(layout.back),
      }
    : layout;

  const [logoVariants, stripVariants, icons] = await Promise.all([
    business.branding?.logo ? fetchLogoVariants(business.branding.logo) : Promise.resolve(null),
    renderStripVariants({
      currentVisits,
      cashbackBalance: customer.stats.cashbackBalance ?? 0,
      config,
      brandColor: primaryColor,
      backgroundUrl: config.card.stripImage,
      customIconUrl: config.card.customIconUrl,
    }),
    iconVariants(config.card.stampIcon, primaryColor),
  ]);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    organizationName: business.name,
    serialNumber,
    description: `Tarjeta de fidelidad — ${business.name}`,
    // Only fall back to a text wordmark when there's no real logo image —
    // Wallet renders logoText next to logo.png, so showing both is redundant.
    ...(logoVariants ? {} : { logoText: business.name }),
    backgroundColor: cssRgb(r, g, b),
    foregroundColor: fg,
    labelColor: label,
    webServiceURL: `${base}/api/wallet/apple`,
    authenticationToken: authToken,
    storeCard: {
      headerFields: fields.header,
      // EMPTY ON PURPOSE. Wallet draws primaryFields on top of strip.png, and
      // strip.png is the stamp card — a populated primary slot reprints the
      // progress across the customer's own stamps.
      primaryFields: [],
      secondaryFields: fields.secondary,
      auxiliaryFields: fields.auxiliary,
      backFields: fields.back,
    },
    barcodes: [
      {
        // The opaque token, never the raw ObjectId — ObjectIds are sequential
        // enough that one leaked id opens a path to guessing its neighbours.
        message: `${base}/c/${customer.publicToken}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: customer.name,
      },
    ],
    ...passLocations(config, {
      progress: isCashback
        ? formatMXN(customer.stats.cashbackBalance ?? 0)
        : `${state.stamps} de ${required}`,
    }),
  };

  const files: Record<string, Buffer> = {
    'pass.json': Buffer.from(JSON.stringify(passJson)),
    'icon.png': icons?.[1] ?? solidColorPNG(29, 29, r, g, b),
    'icon@2x.png': icons?.[2] ?? solidColorPNG(58, 58, r, g, b),
    'icon@3x.png': icons?.[3] ?? solidColorPNG(87, 87, r, g, b),
    'strip.png': stripVariants['1x'],
    'strip@2x.png': stripVariants['2x'],
    'strip@3x.png': stripVariants['3x'],
  };

  if (logoVariants) {
    files['logo.png'] = logoVariants['1x'];
    files['logo@2x.png'] = logoVariants['2x'];
    files['logo@3x.png'] = logoVariants['3x'];
  }

  const pass = new PKPass(
    files,
    {
      wwdr: Buffer.from(wwdrB64, 'base64'),
      signerCert: Buffer.from(certB64, 'base64'),
      signerKey: Buffer.from(keyB64, 'base64'),
      signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE,
    }
  );

  return pass.getAsBuffer();
}
