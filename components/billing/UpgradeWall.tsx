import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Full-page block shown by the dashboard layout when a business's trial has
 * expired (or subscription lapsed) and they're not already on the billing page.
 * Server-rendered — children aren't rendered behind it, so this is a real gate,
 * not a CSS overlay.
 */
export default function UpgradeWall() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <Lock size={26} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          Tu prueba gratuita terminó
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Elige un plan para seguir usando RestKit. Tus datos, menú y configuración
          siguen intactos — solo reactiva tu suscripción para continuar.
        </p>
        <Link
          href="/dashboard/billing"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors no-underline"
        >
          Ver planes y suscribirme
        </Link>
      </div>
    </div>
  );
}
