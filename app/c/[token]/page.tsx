import Customer from '@/models/Customer';
import { businessRepository } from '@/repositories/business.repository';
import { loyaltyConfig } from '@/lib/loyalty';
import { assetSrc } from '@/lib/storage';
import { qrDataUrl } from '@/lib/qr';
import LoyaltyCard from '@/components/loyalty/LoyaltyCard';
import dbConnect from '@/lib/db';
import { notFound } from 'next/navigation';
import { appUrl } from '@/lib/app-url';

export default async function CustomerPassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  await dbConnect();
  // Looked up by the opaque token, never by _id. ObjectIds are sequential
  // enough that one leaked from a receipt opens a path to guessing the rest.
  const customer = await Customer.findOne({ publicToken: token }).select(
    'name stats businessId externalIds'
  );
  if (!customer) notFound();

  const customerId = String(customer._id);

  const business = await businessRepository.findById(
    customer.businessId.toString()
  );
  if (!business) notFound();

  const config = loyaltyConfig(business);
  const primaryColor = business.branding?.primaryColor || '#4f46e5';

  // The same value the wallet pass encodes in its barcode, so the card on this
  // page and the one in the customer's wallet carry the same code.
  const base = appUrl();
  const qr = await qrDataUrl(`${base}/c/${token}`, 400);

  const googleUrl = `/api/passes/google/${customerId}`;
  const appleUrl = `/api/passes/apple/${customerId}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <LoyaltyCard
          businessName={business.name}
          logo={assetSrc(business.branding?.logo)}
          photo={assetSrc(config.card.stripImage)}
          customerName={customer.name}
          config={config}
          brandColor={primaryColor}
          currentVisits={customer.stats.currentVisits}
          cashbackBalance={customer.stats.cashbackBalance ?? 0}
          qrDataUrl={qr}
        />

        {/* Wallet buttons */}
        <div className="space-y-3">
          <p className="text-center text-sm text-gray-500">
            Guárdala en tu wallet y se actualiza sola en cada compra
          </p>

          {/* Google Wallet */}
          <a
            href={googleUrl}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Guardar en Google Wallet
          </a>

          {/* Apple Wallet */}
          <a
            href={appleUrl}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-gray-900 active:scale-95 transition-transform"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Agregar a Apple Wallet
          </a>
        </div>

        <p className="text-center text-xs text-gray-400">
          {business.name} · Tarjeta de fidelidad
        </p>
      </div>
    </div>
  );
}
