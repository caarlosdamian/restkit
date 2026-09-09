import { createSign } from 'crypto';
import { capitalize, loyaltyConfig, stampState, formatMXN } from './loyalty';
import { buildCardLayout } from './card-layout';
import { groundFor } from './card-colors';
import type { ICustomer } from '@/models/Customer';
import type { IBusiness } from '@/models/Business';
import { absoluteAssetUrl } from './storage';
import { appUrl } from './app-url';

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccountJson {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not set');
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    return JSON.parse(raw);
  }
}

function signJwt(payload: object, privateKey: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${h}.${p}`;
  const sig = createSign('RSA-SHA256')
    .update(input)
    .sign(privateKey)
    .toString('base64url');
  return `${input}.${sig}`;
}

async function getAccessToken(): Promise<string> {
  const sa = loadServiceAccount();
  const privateKey = sa.private_key.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const jwt = signJwt(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    },
    privateKey
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`OAuth2 error: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

function buildClass(issuerId: string, business: IBusiness) {
  // Google fetches this url from its own servers, so it has to be absolute —
  // and reachable, which a local `.uploads` path in development is not. The
  // wallet form warns about exactly that when an asset lands on disk.
  const logoUrl =
    absoluteAssetUrl(business.branding?.logo) ||
    'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg';

  const config = loyaltyConfig(business);
  const isCashback = config.mechanic === 'cashback';

  return {
    id: `${issuerId}.${business.slug}`,
    issuerName: business.name,
    reviewStatus: 'UNDER_REVIEW',
    programName: business.name,
    programLogo: {
      sourceUri: { uri: logoUrl },
      contentDescription: {
        defaultValue: { language: 'es', value: business.name },
      },
    },
    localizedIssuerName: {
      defaultValue: { language: 'es', value: business.name },
    },
    // Paints the whole Google card, the way backgroundColor paints the Apple
    // one — and from the same resolved ground, so the two platforms match.
    hexBackgroundColor: groundFor(
      config.card.ground,
      business.branding?.primaryColor || '#4f46e5'
    ),
    rewardsTier: isCashback
      ? `${config.cashback.rate}% de cada compra`
      : config.sellos.rewardDescription,
    rewardsTierLabel: isCashback ? 'Devolución' : 'Premio',
    // Google is the one platform that lets us dictate the row layout outright.
    // Apple only offers named slots on a fixed template, so this is where
    // "control the layout" is actually possible — spend it.
    classTemplateInfo: {
      cardBarcodeSectionDetails: {
        firstTopDetail: {
          fieldSelector: {
            fields: [{ fieldPath: "object.textModulesData['titular']" }],
          },
        },
      },
      detailsTemplateOverride: {
        detailsItemInfos: [
          { item: { firstValue: { fields: [{ fieldPath: "object.textModulesData['reward']" }] } } },
          { item: { firstValue: { fields: [{ fieldPath: "object.textModulesData['howItWorks']" }] } } },
        ],
      },
    },
    countryCode: 'MX',
    ...(config.location?.latitude != null && config.location?.longitude != null
      ? {
          locations: [
            { latitude: config.location.latitude, longitude: config.location.longitude },
          ],
        }
      : {}),
  };
}

/**
 * The points row — Google's equivalent of Apple's primary field.
 *
 * It read as sellos progress for every business, so a cashback programme
 * showed "0 / 10 visitas" on Android while the same customer's iPhone showed
 * their balance.
 */
function pointsFor(config: ReturnType<typeof loyaltyConfig>, customer: ICustomer) {
  if (config.mechanic === 'cashback') {
    return {
      loyaltyPoints: {
        label: 'Saldo',
        balance: { string: formatMXN(customer.stats.cashbackBalance ?? 0) },
      },
      secondaryLoyaltyPoints: {
        label: 'Mínimo para usar',
        balance: { string: formatMXN(config.cashback.threshold) },
      },
    };
  }

  const state = stampState(customer.stats.currentVisits, config.sellos.required);
  return {
    loyaltyPoints: {
      label: capitalize(config.sellos.unitPlural),
      balance: { string: `${state.stamps} / ${config.sellos.required}` },
    },
    secondaryLoyaltyPoints: {
      label: 'Total',
      balance: { int: customer.stats.totalVisits },
    },
  };
}

/**
 * The stamp card as Google's hero banner.
 *
 * Versioned by the counter it depicts: Google caches whatever it fetches, so
 * without a changing URL a customer's card would keep showing the count it had
 * when they first saved it.
 */
function heroImageFor(customer: ICustomer, business: IBusiness) {
  const version =
    loyaltyConfig(business).mechanic === 'cashback'
      ? Math.round((customer.stats.cashbackBalance ?? 0) * 100)
      : customer.stats.currentVisits;

  return {
    sourceUri: { uri: `${appUrl()}/api/passes/strip/${customer.publicToken}?v=${version}` },
    contentDescription: {
      defaultValue: { language: 'es', value: `Tarjeta de ${business.name}` },
    },
  };
}

/**
 * The photo in a band of its own, below the card.
 *
 * Only for `footer` placement — under `background` or `side` the photo is
 * already composited into the hero, and showing it twice would be worse than
 * not showing it at all. This is the placement Apple cannot do: a storeCard has
 * exactly one image slot, and `footer.png` belongs to boardingPass.
 */
function imageModulesFor(business: IBusiness) {
  const config = loyaltyConfig(business);
  if (config.card.photoPlacement !== 'footer') return {};
  const uri = absoluteAssetUrl(config.card.stripImage);
  if (!uri) return {};

  return {
    imageModulesData: [
      {
        id: 'photo',
        mainImage: {
          sourceUri: { uri },
          contentDescription: {
            defaultValue: { language: 'es', value: business.name },
          },
        },
      },
    ],
  };
}

function buildObject(issuerId: string, customer: ICustomer, business: IBusiness) {
  const customerId = (customer._id as { toString(): string }).toString();
  const config = loyaltyConfig(business);

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
      // The hero image IS the stamp card here, and `loyaltyPoints` already
      // states the number, so the progress must not be repeated a third time.
      hasStrip: true,
    },
    config.card.fields
  );

  return {
    id: `${issuerId}.cust-${customerId}`,
    classId: `${issuerId}.${business.slug}`,
    state: 'ACTIVE',
    accountId: customerId,
    accountName: customer.name,
    ...pointsFor(config, customer),
    heroImage: heroImageFor(customer, business),
    ...imageModulesFor(business),
    textModulesData: textModulesFor(layout, customer),
    barcode: {
      type: 'QR_CODE',
      // The opaque token, never the raw ObjectId. Apple and /c/ were fixed for
      // this; Google was still handing out an enumerable id in every QR code.
      value: `${appUrl()}/c/${customer.publicToken}`,
      alternateText: customer.name,
    },
  };
}

/** The layout's fields as Google text modules, keyed so classTemplateInfo
 *  above can address them by name rather than by position. */
function textModulesFor(
  layout: ReturnType<typeof buildCardLayout>,
  customer: ICustomer
): { id: string; header: string; body: string }[] {
  const modules = [...layout.secondary, ...layout.auxiliary, ...layout.back]
    .filter((f) => f.key !== 'progress')
    .map((f) => ({ id: f.key, header: f.label, body: f.value }));

  if (!modules.some((m) => m.id === 'titular')) {
    modules.unshift({ id: 'titular', header: 'TITULAR', body: customer.name });
  }
  // Google caps text modules at 10.
  return modules.slice(0, 10);
}

export function generateGoogleWalletUrl(
  customer: ICustomer,
  business: IBusiness
): string {
  const sa = loadServiceAccount();
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId) throw new Error('GOOGLE_WALLET_ISSUER_ID is not set');

  const privateKey = sa.private_key.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const jwt = signJwt(
    {
      iss: sa.client_email,
      aud: 'google',
      typ: 'savetowallet',
      iat: now,
      payload: {
        loyaltyClasses: [buildClass(issuerId, business)],
        loyaltyObjects: [buildObject(issuerId, customer, business)],
      },
    },
    privateKey
  );

  return `https://pay.google.com/gp/v/save/${jwt}`;
}

export async function updateGoogleWalletObject(
  customer: ICustomer,
  business: IBusiness
): Promise<void> {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId) return;

  const customerId = (customer._id as { toString(): string }).toString();
  const objectId = `${issuerId}.cust-${customerId}`;
  const config = loyaltyConfig(business);

  const token = await getAccessToken();

  const res = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...pointsFor(config, customer),
        // The hero carries the stamps, so an update that left it alone would
        // move the number and leave the picture of the card behind.
        heroImage: heroImageFor(customer, business),
      }),
    }
  );

  // 404 = customer hasn't added the pass yet → nothing to update
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Google Wallet API error: ${await res.text()}`);
}
