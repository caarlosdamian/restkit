import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { businessRepository } from "@/repositories/business.repository";
import ScanClient from "@/components/loyalty/ScanClient";

/**
 * Deliberately NOT under /pos. A business that kept its own register should
 * never have to open a till screen — or a cash session — to stamp a card.
 * Any signed-in role can scan: registering a visit is exactly what the person
 * behind the counter is there to do.
 */
export default async function ScanPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) redirect("/login");

  await dbConnect();
  const business = await businessRepository.findById(session.user.businessId);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto mb-6 w-full max-w-md">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Escanear tarjeta</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Apunta a la tarjeta del cliente para registrar su visita.
        </p>
      </div>
      <ScanClient businessName={business?.name ?? ""} />
    </div>
  );
}
