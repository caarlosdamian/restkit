import { PKPass } from 'passkit-generator';
import { solidColorPNG } from './png';
import type { ICustomer } from '@/models/Customer';
import type { IBusiness } from '@/models/Business';

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

export function generateApplePass(
  customer: ICustomer,
  business: IBusiness
): Buffer {
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

  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const primaryColor = business.branding?.primaryColor || '#4f46e5';
  const [r, g, b] = hexToRgb(primaryColor);

  // Pick foreground color based on luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const fg = lum > 0.5 ? cssRgb(0, 0, 0) : cssRgb(255, 255, 255);
  const label = lum > 0.5 ? cssRgb(80, 80, 80) : cssRgb(200, 200, 200);

  const serialNumber = (customer._id as { toString(): string }).toString();
  const authToken = customer.externalIds?.appleAuthToken || serialNumber;
  const { totalVisits, currentVisits } = customer.stats;
  const required = business.settings.requiredVisits;

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    organizationName: business.name,
    serialNumber,
    description: `Tarjeta de fidelidad — ${business.name}`,
    logoText: business.name,
    backgroundColor: cssRgb(r, g, b),
    foregroundColor: fg,
    labelColor: label,
    webServiceURL: `${appUrl}/api/wallet/apple`,
    authenticationToken: authToken,
    storeCard: {
      primaryFields: [
        {
          key: 'visits',
          label: 'VISITAS',
          value: `${currentVisits} de ${required}`,
          changeMessage: 'Nueva visita registrada. Ahora tienes %@ visitas.',
        },
      ],
      secondaryFields: [
        {
          key: 'name',
          label: 'CLIENTE',
          value: customer.name,
        },
      ],
      auxiliaryFields: [
        {
          key: 'reward',
          label: 'PREMIO',
          value: business.settings.rewardDescription,
        },
      ],
      backFields: [
        {
          key: 'totalVisits',
          label: 'Total de visitas',
          value: String(totalVisits),
        },
        {
          key: 'contact',
          label: 'Contacto',
          value: customer.email || customer.phone || '',
        },
      ],
    },
    barcodes: [
      {
        message: serialNumber,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: customer.name,
      },
    ],
  };

  const icon = solidColorPNG(29, 29, r, g, b);
  const icon2x = solidColorPNG(58, 58, r, g, b);
  const icon3x = solidColorPNG(87, 87, r, g, b);

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': icon,
      'icon@2x.png': icon2x,
      'icon@3x.png': icon3x,
    },
    {
      wwdr: Buffer.from(wwdrB64, 'base64'),
      signerCert: Buffer.from(certB64, 'base64'),
      signerKey: Buffer.from(keyB64, 'base64'),
      signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE,
    }
  );

  return pass.getAsBuffer();
}
