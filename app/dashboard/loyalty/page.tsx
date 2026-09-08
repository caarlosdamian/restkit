import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import { analyticsService, type ReportPeriod } from "@/services/analytics.service";
import { businessRepository } from "@/repositories/business.repository";
import { loyaltyConfig, formatMXN } from "@/lib/loyalty";
import Link from "next/link";
import {
  Gift,
  Users,
  TrendingUp,
  ChevronRight,
  UserPlus,
  Repeat,
  Wallet,
  Settings2,
  Download,
} from "lucide-react";

const PERIODS: Array<{ key: ReportPeriod; label: string }> = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "7 días" },
  { key: "month", label: "30 días" },
];

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");
  if (session.user.role === "STAFF") redirect("/dashboard/customers");
  if (!session?.user?.businessId) return <div>Sin negocio configurado.</div>;

  const { period: raw } = await searchParams;
  const period: ReportPeriod =
    raw === "today" || raw === "week" ? raw : "month";

  await dbConnect();
  const [stats, report, business] = await Promise.all([
    analyticsService.getDashboardStats(session.user.businessId),
    analyticsService.getLoyaltyReport(session.user.businessId, period),
    businessRepository.findById(session.user.businessId),
  ]);

  const loyalty = loyaltyConfig(business);
  const isCashback = loyalty.mechanic === "cashback";
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Fidelización</h1>
          <p className="text-sm text-gray-500 mt-0.5">¿Está funcionando el programa?</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/dashboard/loyalty?period=${p.key}`}
                className={`px-3 py-2 text-xs font-semibold no-underline transition-colors ${
                  period === p.key
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <a
            href={`/api/reports/loyalty.csv?period=${period}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 no-underline transition-colors"
          >
            <Download size={13} /> CSV
          </a>
          <Link
            href="/dashboard/settings/wallet"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 no-underline transition-colors"
          >
            <Settings2 size={13} /> Tarjeta
          </Link>
        </div>
      </div>

      {/* ── The headline: does a card make people spend more? ── */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-emerald-500" />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Ticket promedio
          </p>
        </div>

        {report.ordersWithCard === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            Aún no hay órdenes con cliente identificado en este periodo. Captura el
            teléfono al cobrar para empezar a comparar.
          </p>
        ) : (
          <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">Con tarjeta</p>
              <p className="text-3xl font-extrabold tracking-tight text-gray-900">
                {formatMXN(report.avgWithCard)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{report.ordersWithCard} órdenes</p>
            </div>

            <div
              className={`text-center px-4 py-2 rounded-xl ${
                report.uplift >= 0 ? "bg-emerald-50" : "bg-rose-50"
              }`}
            >
              <p
                className={`text-2xl font-extrabold tracking-tight ${
                  report.uplift >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {report.uplift >= 0 ? "+" : ""}
                {pct(report.uplift)}
              </p>
              <p className="text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide">
                diferencia
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1">Sin tarjeta</p>
              <p className="text-3xl font-extrabold tracking-tight text-gray-400">
                {formatMXN(report.avgAnonymous)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{report.ordersAnonymous} órdenes</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Programme health ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={<Users size={17} />}
          label="Clientes"
          value={String(report.totalCustomers)}
          hint={`${pct(report.attachRate)} de las órdenes`}
        />
        <Stat
          icon={<UserPlus size={17} />}
          label="Altas esta semana"
          value={String(report.signupsThisWeek)}
        />
        <Stat
          icon={<Repeat size={17} />}
          label="Regresan"
          value={pct(report.returnRate)}
          hint={`de ${report.activeCustomers} activos · 30 días`}
        />
        <Stat
          icon={<Gift size={17} />}
          label="Premios entregados"
          value={String(report.rewardsDelivered)}
          hint={isCashback ? undefined : loyalty.sellos.rewardDescription}
        />
      </div>

      {/* ── Cashback economics ── */}
      {(isCashback || report.cashbackLiability > 0) && (
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Wallet size={16} className="text-gray-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Cashback</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Acumulado</p>
              <p className="text-xl font-extrabold text-gray-900">
                {formatMXN(report.cashbackAccrued)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Canjeado</p>
              <p className="text-xl font-extrabold text-gray-900">
                {formatMXN(report.cashbackRedeemed)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Pasivo vivo</p>
              <p className="text-xl font-extrabold text-amber-600">
                {formatMXN(report.cashbackLiability)}
              </p>
            </div>
          </div>
          {/* The balance never expires, so this figure only grows. Showing it
              is the whole mitigation. */}
          <p className="text-xs text-gray-400 mt-4">
            El saldo no vence: el pasivo vivo es dinero que le debes a tus clientes.
          </p>
        </div>
      )}

      {/* ── Top customers ── */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Clientes más frecuentes
          </p>
          <Link
            href="/dashboard/customers"
            className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-0.5"
          >
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
                <span className="w-5 text-xs font-bold text-gray-300 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min((c.currentVisits / loyalty.sellos.required) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{c.currentVisits}</p>
                  <p className="text-[0.65rem] text-gray-400">/ {loyalty.sellos.required}</p>
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

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">
          {label}
        </p>
      </div>
      <p className="text-3xl font-extrabold tracking-tight text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1 truncate">{hint}</p>}
    </div>
  );
}
