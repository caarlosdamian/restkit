import { notFound } from "next/navigation";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import { loyaltyConfig } from "@/lib/loyalty";
import { assetSrc } from "@/lib/storage";
import { groundFor, readableInk, relLuminance } from "@/lib/card-colors";
import JoinForm from "@/components/loyalty/JoinForm";

/**
 * The page behind the QR a business prints for its tables.
 *
 * Public and unauthenticated — a customer with a phone is the only participant.
 * Short path on purpose (`/j/<slug>`): it gets printed, and every character is
 * one more the QR has to encode.
 */
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  await dbConnect();
  const business = await Business.findOne({ slug });
  if (!business) notFound();

  const config = loyaltyConfig(business);
  const brand = business.branding?.primaryColor || "#4f46e5";
  const ground = groundFor(config.card.ground, brand);
  const onDark = relLuminance(ground) < 0.4;
  const ink = readableInk(brand, ground);
  const logo = assetSrc(business.branding?.logo);

  const isCashback = config.mechanic === "cashback";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div
          className="overflow-hidden rounded-3xl px-6 py-7 text-center shadow-xl ring-1 ring-black/5"
          style={{ backgroundColor: ground, color: onDark ? "#ffffff" : "#141a21" }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={business.name} className="mx-auto h-9 max-w-[12rem] object-contain" />
          ) : (
            <p className="text-lg font-extrabold tracking-tight">{business.name}</p>
          )}

          <p className="mt-4 text-sm opacity-75">
            {isCashback ? "Te devolvemos" : "Junta y gana"}
          </p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight" style={{ color: ink }}>
            {isCashback
              ? `${config.cashback.rate}%`
              : `${config.sellos.required} ${config.sellos.unitPlural}`}
          </p>
          <p className="mt-1.5 text-sm opacity-85">
            {isCashback
              ? "de cada compra, en saldo para usar aquí"
              : config.sellos.rewardDescription}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-extrabold tracking-tight text-gray-900">
            Crea tu tarjeta
          </h1>
          <p className="mb-4 mt-0.5 text-sm text-gray-500">
            Se guarda en tu wallet. No hay que instalar nada.
          </p>
          <JoinForm slug={slug} accent={ink} />
        </div>

        <p className="text-center text-xs text-gray-400">{business.name}</p>
      </div>
    </div>
  );
}
