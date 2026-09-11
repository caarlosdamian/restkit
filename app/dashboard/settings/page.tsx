import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import { businessRepository } from "@/repositories/business.repository";
import SettingsForm from "@/components/settings/SettingsForm";
import PasswordForm from "@/components/settings/PasswordForm";
import EmailForm from "@/components/settings/EmailForm";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { assetSrc } from "@/lib/storage";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ correo?: string; error?: string }>;
}) {
  const { correo, error } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role === "STAFF") redirect("/dashboard/customers");

  await dbConnect();
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

      {/* Where the confirmation link from a change-of-email lands. The error
          case is checked first: better-auth appends `&error=` to the callback
          it was given, so a failed confirmation arrives carrying BOTH flags. */}
      {error ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="text-sm leading-snug text-amber-800">
            <p className="font-semibold">No pudimos confirmar el correo.</p>
            <p className="mt-1 text-amber-700">{confirmationError(error)}</p>
          </div>
        </div>
      ) : correo === "confirmado" ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="text-sm leading-snug text-emerald-800">
            <p className="font-semibold">Listo, tu correo quedó actualizado.</p>
            <p className="mt-1 text-emerald-700">
              A partir de ahora entra con {session.user.email}, aquí y en la terminal del
              punto de venta. Tu contraseña es la misma de siempre.
            </p>
          </div>
        </div>
      ) : null}

      <SettingsForm
        initial={{
          name: business.name,
          branding: {
            primaryColor: business.branding?.primaryColor ?? "#10b981",
            logo: assetSrc(business.branding?.logo),
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

      <EmailForm email={session.user.email} />

      <PasswordForm email={session.user.email} />
    </div>
  );
}

/** better-auth redirects with its own code; the owner reads Spanish. */
function confirmationError(code: string): string {
  switch (code) {
    case "TOKEN_EXPIRED":
      return "El enlace ya venció. Pide el cambio otra vez y abre el correo nuevo dentro de la hora siguiente.";
    case "INVALID_TOKEN":
      return "El enlace no es válido. Puede que ya lo hayas usado: revisa arriba con qué correo estás entrando.";
    case "INVALID_USER":
      return "Ese enlace es de otra cuenta. Cierra sesión y ábrelo de nuevo desde el correo.";
    case "USER_NOT_FOUND":
      return "No encontramos la cuenta de ese enlace.";
    default:
      return "Vuelve a pedir el cambio desde el formulario de abajo.";
  }
}
