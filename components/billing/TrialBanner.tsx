import Link from "next/link";
import { Clock } from "lucide-react";

/**
 * Slim banner shown across the dashboard while a business is still in its free
 * trial, nudging toward upgrade. Rendered by the dashboard layout above the
 * page content.
 */
export default function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const label =
    daysLeft <= 0
      ? "Tu prueba termina hoy"
      : daysLeft === 1
        ? "Queda 1 día de prueba"
        : `Quedan ${daysLeft} días de prueba`;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <Clock size={16} className="text-amber-500 shrink-0" />
      <p className="text-sm font-medium text-amber-800">{label}.</p>
      <Link
        href="/dashboard/billing"
        className="ml-auto text-sm font-semibold text-amber-700 underline-offset-2 hover:underline"
      >
        Elegir un plan
      </Link>
    </div>
  );
}
