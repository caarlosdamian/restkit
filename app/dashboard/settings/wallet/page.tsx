import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import dbConnect from "@/lib/db";
import { businessRepository } from "@/repositories/business.repository";
import { loyaltyConfig } from "@/lib/loyalty";
import { assetSrc } from "@/lib/storage";
import { defaultCardFields } from "@/lib/card-fields";
import WalletForm from "@/components/settings/WalletForm";

export default async function WalletSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!["OWNER", "ADMIN"].includes(session.user.role)) redirect("/dashboard/customers");
  if (!session.user.businessId) return <div>Sin negocio configurado.</div>;

  await dbConnect();
  const business = await businessRepository.findById(session.user.businessId);
  if (!business) return <div>Sin negocio configurado.</div>;

  const config = loyaltyConfig(business);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Configuración
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          Tarjeta de fidelidad
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Diseña la tarjeta que tus clientes guardan en Apple Wallet y Google Wallet.
        </p>
      </div>

      <WalletForm
        initial={{
          mechanic: config.mechanic,
          sellos: {
            required: config.sellos.required,
            rewardDescription: config.sellos.rewardDescription,
            unitSingular: config.sellos.unitSingular,
            unitPlural: config.sellos.unitPlural,
          },
          cashback: { rate: config.cashback.rate, threshold: config.cashback.threshold },
          notifications: { ...config.notifications },
          card: {
            ground: config.card.ground,
            stampStyle: config.card.stampStyle,
            stampIcon: config.card.stampIcon,
            photoPlacement: config.card.photoPlacement,
            fields: config.card.fields ?? defaultCardFields(config.mechanic),
            // Normalised for the browser: a local asset is stored relative now,
            // but rows written before that still hold an absolute tunnel host.
            customIconUrl: assetSrc(config.card.customIconUrl),
            stripImage: assetSrc(config.card.stripImage),
          },
          location: config.location
            ? {
                latitude: config.location.latitude,
                longitude: config.location.longitude,
                relevantText: config.location.relevantText,
              }
            : undefined,
        }}
        businessName={business.name}
        primaryColor={business.branding?.primaryColor ?? "#10b981"}
        logo={assetSrc(business.branding?.logo)}
      />
    </div>
  );
}
