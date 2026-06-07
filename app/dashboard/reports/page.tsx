import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, Users } from "lucide-react";
import { analyticsService, type ReportPeriod } from "@/services/analytics.service";

const PERIODS: Array<{ key: ReportPeriod; label: string }> = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "7 días" },
  { key: "month", label: "30 días" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!["OWNER", "ADMIN"].includes(session.user.role as string)) redirect("/dashboard/pos");

  const sp = await searchParams;
  const period = (["today", "week", "month"].includes(sp.period || "")
    ? sp.period
    : "today") as ReportPeriod;

  const { grandTotal, waiters } = await analyticsService.getWaiterSales(
    session.user.businessId,
    period
  );

  const totalItems = waiters.reduce((s, w) => s + w.itemCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Ventas por mesero</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Ingresos atribuidos a cada mesero según los productos que agregó.
        </p>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {PERIODS.map(({ key, label }) => (
            <Link
              key={key}
              href={`/dashboard/reports?period=${key}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors no-underline ${
                period === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{waiters.length} meseros con ventas</span>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Ingresos del período</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900">${grandTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Productos vendidos</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900">{totalItems}</p>
        </div>
      </div>

      {/* Waiter breakdown */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {waiters.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mb-3">
              <BarChart3 size={24} />
            </div>
            <p className="text-sm font-semibold text-gray-900">Sin ventas en este período</p>
            <p className="text-xs text-gray-400 mt-1">
              Las ventas pagadas aparecerán aquí, atribuidas a cada mesero.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {waiters.map((w, idx) => (
              <li key={w.staffId ?? `none-${idx}`} className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">
                    {w.name === "Sin asignar" ? (
                      <Users size={16} />
                    ) : (
                      w.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{w.name}</p>
                    <p className="text-xs text-gray-400">
                      {w.itemCount} producto{w.itemCount !== 1 ? "s" : ""} · {w.orderCount} orden
                      {w.orderCount !== 1 ? "es" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-gray-900">${w.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{(w.share * 100).toFixed(0)}%</p>
                  </div>
                </div>
                {/* Share bar */}
                <div className="mt-2.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(2, w.share * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
