import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { analyticsService } from "@/services/analytics.service";
import { businessRepository } from "@/repositories/business.repository";
import Link from "next/link";
import { Gift, Users, ScanLine, ChevronRight } from "lucide-react";

export default async function LoyaltyPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");
  if (session.user.role === "STAFF") redirect("/dashboard/customers");
  if (!session?.user?.businessId) return <div>Sin negocio configurado.</div>;

  const [stats, business] = await Promise.all([
    analyticsService.getDashboardStats(session.user.businessId),
    businessRepository.findById(session.user.businessId),
  ]);

  const rewardRate =
    stats.visitsThisWeek > 0
      ? Math.round((stats.rewardsDelivered / stats.visitsThisWeek) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Fidelización</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Programa de lealtad y tarjetas digitales.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Users size={18} />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clientes</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">{stats.totalCustomers}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Gift size={18} />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Premios entregados</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">{stats.rewardsDelivered}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ScanLine size={18} />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visitas esta semana</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">{stats.visitsThisWeek}</p>
        </div>
      </div>

      {/* Program config */}
      {business && (
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Configuración del programa</p>
            <Link href="/dashboard/settings" className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-0.5">
              Editar <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">Visitas para premio</p>
              <p className="text-2xl font-extrabold text-gray-900">{business.settings.requiredVisits}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">Premio</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">{business.settings.rewardDescription}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top customers */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Clientes más frecuentes</p>
          <Link href="/dashboard/customers" className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-0.5">
            Ver todos <ChevronRight size={13} />
          </Link>
        </div>
        {stats.topCustomers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin clientes aún.</p>
        ) : (
          <div className="space-y-2">
            {stats.topCustomers.map((c, i) => (
              <Link
                key={c.id}
                href={`/dashboard/customers/${c.id}`}
                className="flex items-center gap-3 rounded-xl hover:bg-gray-50 px-2 py-2 -mx-2 transition-colors group no-underline"
              >
                <span className="w-5 text-xs font-bold text-gray-300 text-right shrink-0">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min((c.currentVisits / (business?.settings.requiredVisits ?? 10)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{c.currentVisits}</p>
                  <p className="text-[0.65rem] text-gray-400">/ {business?.settings.requiredVisits}</p>
                </div>
                <ChevronRight size={14} className="text-gray-200 group-hover:text-emerald-500 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
