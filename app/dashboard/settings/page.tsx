import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { businessRepository } from "@/repositories/business.repository";
import SettingsForm from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role === "STAFF") redirect("/dashboard/customers");

  const business = await businessRepository.findById(session.user.businessId);
  if (!business) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Administra los datos de tu negocio y el diseño del ticket.
        </p>
      </div>

      <SettingsForm
        initial={{
          name: business.name,
          branding: {
            primaryColor: business.branding?.primaryColor ?? "#10b981",
            logo: business.branding?.logo,
          },
          settings: {
            requiredVisits: business.settings?.requiredVisits ?? 10,
            rewardDescription: business.settings?.rewardDescription ?? "",
          },
          ticket: {
            fiscalName:    business.ticket?.fiscalName,
            rfc:           business.ticket?.rfc,
            phone:         business.ticket?.phone,
            address:       business.ticket?.address,
            fiscalAddress: business.ticket?.fiscalAddress,
            website:       business.ticket?.website,
            footerMessage: business.ticket?.footerMessage ?? "¡Gracias por su visita!",
          },
        }}
      />
    </div>
  );
}
