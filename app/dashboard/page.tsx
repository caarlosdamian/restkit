import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { analyticsService } from "@/services/analytics.service";
import Business from "@/models/Business";
import dbConnect from "@/lib/db";
import { Users, ScanLine, Gift, TrendingUp, UserPlus, ChevronRight } from "lucide-react";
import Link from "next/link";
import SeedButton from "@/components/dashboard/SeedButton";
import SeedDataButton from "@/components/dashboard/SeedDataButton";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  // STAFF only sees customers — redirect them directly
  if (session.user.role === "STAFF") redirect("/dashboard/customers");

  if (!session?.user?.businessId) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-10 text-center">
        <p className="text-sm text-gray-500">Sin negocio configurado. Completa el registro.</p>
      </div>
    );
  }

  // Fetch business to get restaurant code
  await dbConnect();
  const businessId = session.user.businessId as string;
  const business = await Business.findById(businessId);
  const restaurantCode = business?.slug || "unknown";

  const stats = await analyticsService.getDashboardStats(businessId);
  const maxChart = Math.max(...stats.chartData.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Resumen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rendimiento de tu negocio en tiempo real.</p>
        </div>
        <Link
          href="/dashboard/customers/new"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm"
        >
          <UserPlus size={15} /> Nuevo Cliente
        </Link>
      </div>

      {/* Restaurant Code & Seed Data */}
      {(session.user.role === "OWNER" || session.user.role === "ADMIN") && (
        <SeedDataButton restaurantCode={restaurantCode} />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} />}
          label="Total Clientes"
          value={stats.totalCustomers}
          href="/dashboard/customers"
        />
        <StatCard
          icon={<ScanLine size={20} />}
          label="Visitas Hoy"
          value={stats.visitsToday}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Esta Semana"
          value={stats.visitsThisWeek}
        />
        <StatCard
          icon={<Gift size={20} />}
          label="Premios Entregados"
          value={stats.rewardsDelivered}
        />
      </div>

      {/* Chart + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar chart */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-6">
            Visitas — últimos 7 días
          </p>
          {stats.visitsThisWeek === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-gray-400">
              Sin visitas esta semana todavía.
            </div>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {stats.chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[0.65rem] font-semibold text-gray-400">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-emerald-500 transition-all min-h-[4px]"
                    style={{ height: `${Math.max((d.count / maxChart) * 100, d.count > 0 ? 8 : 2)}%` }}
                  />
                  <span className="text-[0.6rem] text-gray-400 text-center leading-tight">
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
            Actividad Reciente
          </p>
          {stats.recentVisits.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin actividad aún.</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentVisits.map((v) => (
                <li key={v.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {v.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{v.customerName}</p>
                    <p className="text-[0.65rem] text-gray-400">
                      {v.type === "REWARD_REDEMPTION" ? "🎁 Premio canjeado" : "✓ Visita"}
                      {" · "}
                      {v.timeAgo}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Top customers */}
      {stats.topCustomers.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Clientes Frecuentes
            </p>
            <Link
              href="/dashboard/customers"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
            >
              Ver todos <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-2">
            {stats.topCustomers.map((c, i) => (
              <Link
                key={c.id}
                href={`/dashboard/customers/${c.id}`}
                className="flex items-center gap-3 rounded-xl hover:bg-gray-50 px-2 py-2 -mx-2 transition-colors group"
              >
                <span className="w-5 text-xs font-bold text-gray-300 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.contact}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{c.totalVisits}</p>
                  <p className="text-[0.65rem] text-gray-400">visitas</p>
                </div>
                <ChevronRight size={14} className="text-gray-200 group-hover:text-emerald-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
          Acciones Rápidas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/dashboard/customers/new" icon={<UserPlus size={22} />} label="Nuevo Cliente" />
          <QuickAction href="/dashboard/customers" icon={<Users size={22} />} label="Ver Clientes" />
          <QuickActionDisabled icon={<ScanLine size={22} />} label="Escanear QR" tag="Próximo" />
          <QuickActionDisabled icon={<TrendingUp size={22} />} label="Reportes" tag="Próximo" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          {icon}
        </div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">{label}</p>
      </div>
      <p className="text-4xl font-extrabold tracking-tight text-gray-900">{value}</p>
    </div>
  );
  return href ? <Link href={href} className="no-underline">{content}</Link> : content;
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group no-underline"
    >
      <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">{icon}</div>
      <span className="text-xs font-semibold text-gray-700 group-hover:text-emerald-600 transition-colors text-center">
        {label}
      </span>
    </Link>
  );
}

function QuickActionDisabled({ icon, label, tag }: { icon: React.ReactNode; label: string; tag: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed relative">
      <div className="text-gray-300">{icon}</div>
      <span className="text-xs font-semibold text-gray-400 text-center">{label}</span>
      <span className="absolute top-2 right-2 text-[0.55rem] font-bold uppercase bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
        {tag}
      </span>
    </div>
  );
}
