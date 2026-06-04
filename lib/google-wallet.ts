import { createSign } from 'crypto';
import type { ICustomer } from '@/models/Customer';
import type { IBusiness } from '@/models/Business';

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
  const logoUrl =
    business.branding?.logo ||
    'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg';

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
    rewardsTier: business.settings.rewardDescription,
    rewardsTierLabel: 'Premio',
    countryCode: 'MX',
  };
}

function buildObject(
  issuerId: string,
  customer: ICustomer,
  business: IBusiness
) {
  const customerId = (customer._id as { toString(): string }).toString();
  const required = business.settings.requiredVisits;
  const current = customer.stats.currentVisits;

  return {
    id: `${issuerId}.cust-${customerId}`,
    classId: `${issuerId}.${business.slug}`,
    state: 'ACTIVE',
    accountId: customerId,
    accountName: customer.name,
    loyaltyPoints: {
      label: 'Visitas',
      balance: { string: `${current} / ${required}` },
    },
    secondaryLoyaltyPoints: {
      label: 'Total',
      balance: { int: customer.stats.totalVisits },
    },
    textModulesData: [
      {
        id: 'reward',
        header: 'Premio',
        body: business.settings.rewardDescription,
      },
      {
        id: 'contact',
        header: 'Contacto',
        body: customer.email || customer.phone || '',
      },
    ],
    barcode: {
      type: 'QR_CODE',
      value: customerId,
      alternateText: customer.name,
    },
  };
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
  const required = business.settings.requiredVisits;
  const current = customer.stats.currentVisits;

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
        loyaltyPoints: {
          label: 'Visitas',
          balance: { string: `${current} / ${required}` },
        },
        secondaryLoyaltyPoints: {
          label: 'Total',
          balance: { int: customer.stats.totalVisits },
        },
        textModulesData: [
          {
            id: 'reward',
            header: 'Premio',
            body: business.settings.rewardDescription,
          },
        ],
      }),
    }
  );

  // 404 = customer hasn't added the pass yet → nothing to update
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Google Wallet API error: ${await res.text()}`);
}
