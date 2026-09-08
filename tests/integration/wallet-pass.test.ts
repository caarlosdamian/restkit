import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import Customer from '@/models/Customer';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';
import { generateGoogleWalletUrl } from '@/lib/google-wallet';
import type { IBusiness } from '@/models/Business';
import type { ICustomer } from '@/models/Customer';

import { GET as stripRoute } from '@/app/api/passes/strip/[token]/route';

beforeAll(async () => {
  await startTestDb();
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
    client_email: 'wallet@restkit.test',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  });
  process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000000000000';
  process.env.APP_URL = 'https://restkit.test';
});
afterAll(stopTestDb);
beforeEach(clearTestDb);

async function seed(loyalty: Partial<typeof DEFAULT_LOYALTY> = {}, stats = {}) {
  const businessId = oid();
  const business = await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    branding: { primaryColor: '#b3202c' },
    settings: { loyalty: { ...DEFAULT_LOYALTY, ...loyalty } },
  });
  const customer = await Customer.create({
    businessId,
    name: 'Ana Pérez',
    phone: '5512345678',
    stats: { totalVisits: 14, currentVisits: 4, cashbackBalance: 62.5, ...stats },
  });
  return { business: business as IBusiness, customer: customer as ICustomer };
}

/** The Save-to-Wallet URL is a signed JWT whose `payload` claim is the pass. */
function payloadOf(url: string) {
  const jwt = url.split('/save/')[1];
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return claims.payload as { loyaltyClasses: any[]; loyaltyObjects: any[] };
}

describe('Google Wallet pass', () => {
  it('never puts an enumerable ObjectId in the QR code', async () => {
    // Apple and /c/ were fixed for this; Google was still handing out the raw
    // customer id in every scanned code, which reopens the same guessing path.
    const { business, customer } = await seed();
    const { loyaltyObjects } = payloadOf(generateGoogleWalletUrl(customer, business));

    expect(loyaltyObjects[0].barcode.value).toBe(`https://restkit.test/c/${customer.publicToken}`);
    expect(loyaltyObjects[0].barcode.value).not.toContain(String(customer._id));
  });

  it('carries the stamp card as a hero image, versioned by the count', async () => {
    // Android used to get "4 / 10" and nothing else. Google caches what it
    // fetches, so the URL has to change when the number does.
    const { business, customer } = await seed();
    const { loyaltyObjects } = payloadOf(generateGoogleWalletUrl(customer, business));
    const uri = loyaltyObjects[0].heroImage.sourceUri.uri;

    expect(uri).toBe(`https://restkit.test/api/passes/strip/${customer.publicToken}?v=4`);
  });

  it('shows a balance for a cashback programme, not stamps', async () => {
    // The points row read as sellos progress for every business, so a cashback
    // customer saw "0 / 10 visitas" on Android and their balance on iPhone.
    const { business, customer } = await seed({ mechanic: 'cashback' });
    const { loyaltyObjects } = payloadOf(generateGoogleWalletUrl(customer, business));

    expect(loyaltyObjects[0].loyaltyPoints).toMatchObject({
      label: 'Saldo',
      balance: { string: '$62.50' },
    });
    expect(loyaltyObjects[0].heroImage.sourceUri.uri).toContain('?v=6250');
  });

  it('paints the card and dictates its rows', async () => {
    const { business, customer } = await seed({
      ...DEFAULT_LOYALTY,
      card: { ...DEFAULT_LOYALTY.card, ground: 'brand' },
    });
    const { loyaltyClasses } = payloadOf(generateGoogleWalletUrl(customer, business));

    expect(loyaltyClasses[0].hexBackgroundColor).toBe('#b3202c');
    // Google is the one platform that lets us override the row template.
    expect(loyaltyClasses[0].classTemplateInfo).toBeTruthy();
  });

  it('addresses its text modules by name, so the template cannot drift', async () => {
    const { business, customer } = await seed();
    const { loyaltyClasses, loyaltyObjects } = payloadOf(
      generateGoogleWalletUrl(customer, business)
    );

    const referenced = JSON.stringify(loyaltyClasses[0].classTemplateInfo).match(
      /textModulesData\['(\w+)'\]/g
    );
    const ids = new Set(loyaltyObjects[0].textModulesData.map((m: { id: string }) => m.id));
    for (const ref of referenced ?? []) {
      expect(ids.has(ref.replace(/.*\['|'\]/g, ''))).toBe(true);
    }
  });
});

describe('where the photo goes on Google', () => {
  it('gives it a band of its own under `footer` — the placement Apple cannot do', () => {
    // A storeCard has exactly one image slot and the stamps occupy it;
    // `footer.png` belongs to boardingPass. Google has imageModulesData.
    return seed({
      card: { ...DEFAULT_LOYALTY.card, photoPlacement: 'footer', stripImage: '/api/uploads/business/1/local.jpg' },
    }).then(({ business, customer }) => {
      const { loyaltyObjects } = payloadOf(generateGoogleWalletUrl(customer, business));
      expect(loyaltyObjects[0].imageModulesData[0].mainImage.sourceUri.uri).toBe(
        'https://restkit.test/api/uploads/business/1/local.jpg'
      );
    });
  });

  it('does NOT repeat it when it is already composited into the hero', async () => {
    for (const photoPlacement of ['background', 'side'] as const) {
      const { business, customer } = await seed({
        card: { ...DEFAULT_LOYALTY.card, photoPlacement, stripImage: '/api/uploads/business/1/local.jpg' },
      });
      const { loyaltyObjects } = payloadOf(generateGoogleWalletUrl(customer, business));
      expect(loyaltyObjects[0].imageModulesData).toBeUndefined();
    }
  });

  it('adds no empty module when there is no photo at all', async () => {
    const { business, customer } = await seed({
      card: { ...DEFAULT_LOYALTY.card, photoPlacement: 'footer' },
    });
    const { loyaltyObjects } = payloadOf(generateGoogleWalletUrl(customer, business));
    expect(loyaltyObjects[0].imageModulesData).toBeUndefined();
  });
});

describe('GET /api/passes/strip/[token]', () => {
  const call = (token: string) =>
    stripRoute(new Request(`https://restkit.test/api/passes/strip/${token}`), {
      params: Promise.resolve({ token }),
    });

  it('renders the customer card as a PNG for Google to fetch', async () => {
    const { customer } = await seed();
    const res = await call(customer.publicToken!);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    // A real PNG signature, not an error page.
    expect(Buffer.from(await res.arrayBuffer()).subarray(1, 4).toString()).toBe('PNG');
  });

  it('404s on an unknown token rather than leaking whether it exists', async () => {
    expect((await call('not-a-real-token')).status).toBe(404);
  });
});
