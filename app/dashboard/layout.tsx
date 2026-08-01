import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import Business from "@/models/Business";
import dbConnect from "@/lib/db";
import { evaluateSubscription, featureAllowed } from "@/lib/subscription";
import { getPlan } from "@/lib/plans";
import type { ISubscription } from "@/models/Business";
import UpgradeWall from "@/components/billing/UpgradeWall";
import TrialBanner from "@/components/billing/TrialBanner";
import {
  Home, Users, Settings, UserCog, Gift,
  ChefHat, Package, ClipboardList,
  BarChart3, FileText, Truck, UtensilsCrossed,
  ShoppingCart, ExternalLink, LayoutGrid, CreditCard,
} from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) redirect("/login");

  const role = session.user.role as string;
  const isOwner = role === "OWNER";
  const isAdmin = role === "ADMIN";
  const canSeeAnalytics = isOwner || isAdmin;

  // Subscription gate. The billing page is always reachable (so an expired
  // business can pay), everything else is blocked once the trial/subscription
  // lapses. Missing subscription data is grandfathered — see lib/subscription.
  let sub = { active: true, trialing: false, trialDaysLeft: 0, needsUpgrade: false, subscribed: false, status: "none" } as ReturnType<typeof evaluateSubscription>;
  let subscription: ISubscription | undefined;
  if (session.user.businessId) {
    await dbConnect();
    const business = await Business.findById(session.user.businessId).select("subscription");
    subscription = business?.subscription ?? undefined;
    sub = evaluateSubscription(subscription);
  }
  // Tier flags — gated features get an upgrade badge in the nav when the
  // current plan doesn't include them (the pages themselves show the upsell).
  const hasInventory = featureAllowed(subscription, "inventory");
  const hasReports = featureAllowed(subscription, "reports");
  const hasKds = featureAllowed(subscription, "kds");
  const hasPos = featureAllowed(subscription, "pos");
  const planName = subscription?.plan ? getPlan(subscription.plan)?.name : undefined;
  const pathname = hdrs.get("x-pathname") || "";
  const onBillingPage = pathname.startsWith("/dashboard/billing");
  const gated = sub.needsUpgrade && !onBillingPage;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg tracking-tight no-underline">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#10b981" />
            <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
          </svg>
          RestKit
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-0.5">
          {/* Owner / Admin — analytics home */}
          {canSeeAnalytics && (
            <NavLink href="/dashboard" icon={Home} label="Inicio" />
          )}

          {/* Quick jump to the POS terminal — opens the separate /pos surface
              in a new tab (the POS is not embedded in the dashboard). */}
          <a
            href="/pos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors no-underline"
          >
            <ShoppingCart size={17} className="shrink-0" />
            Abrir POS
            {!hasPos && <TierBadge tier="Básico" />}
            <ExternalLink size={13} className="ml-auto text-emerald-400" />
          </a>

          {/* Kitchen display — also a /pos surface, opens in its own tab. */}
          <a
            href="/pos/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors no-underline"
          >
            <ChefHat size={17} className="shrink-0" />
            Cocina (KDS)
            {!hasKds && <TierBadge tier="Pro" />}
            <ExternalLink size={13} className="ml-auto text-amber-400" />
          </a>

          <NavLink href="/dashboard/customers" icon={Users} label="Clientes" />
          <NavLink href="/dashboard/loyalty" icon={Gift} label="Fidelización" />

          {/* Owner / Admin — menu management + orders */}
          {canSeeAnalytics && (
            <NavLink href="/dashboard/menu" icon={UtensilsCrossed} label="Menú" />
          )}
          {canSeeAnalytics && (
            <NavLink href="/dashboard/tables" icon={LayoutGrid} label="Mesas" />
          )}
          {canSeeAnalytics && (
            <NavLink href="/dashboard/orders" icon={ClipboardList} label="Historial" />
          )}
          {canSeeAnalytics && (
            <NavLink href="/dashboard/reports" icon={BarChart3} label="Reportes" upgradeTier={!hasReports ? "Pro" : undefined} />
          )}
          {canSeeAnalytics && (
            <NavLink href="/dashboard/inventory" icon={Package} label="Inventario" upgradeTier={!hasInventory ? "Pro" : undefined} />
          )}

          {/* Owner only */}
          {isOwner && (
            <NavLink href="/dashboard/staff" icon={UserCog} label="Empleados" />
          )}
          {isOwner && (
            <NavLink href="/dashboard/billing" icon={CreditCard} label="Suscripción" />
          )}

          {/* Coming soon */}
          <div className="mt-4 mb-2 px-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-300">Próximamente</p>
          </div>
          {[
            { icon: FileText, label: "Facturación" },
            { icon: Truck, label: "Delivery" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed select-none"
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
              <span className="ml-auto text-[0.55rem] font-bold bg-gray-100 text-gray-300 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Pronto
              </span>
            </div>
          ))}

          {/* Settings — owner/admin */}
          {canSeeAnalytics && (
            <div className="mt-auto pt-4 border-t border-gray-100">
              <NavLink href="/dashboard/settings" icon={Settings} label="Configuración" />
            </div>
          )}
        </nav>
    </>
  );

  const headerContent = (
    <>
      <p className="text-sm font-semibold text-gray-900 truncate min-w-0">{session.user.name}</p>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {planName && <PlanBadge name={planName} trialing={sub.trialing && !sub.subscribed} />}
        <RoleBadge role={role} />
        <LogoutButton />
      </div>
    </>
  );

  return (
    <DashboardShell sidebar={sidebarContent} header={headerContent}>
      {gated ? (
        <UpgradeWall />
      ) : (
        <>
          {sub.trialing && !sub.subscribed && <TrialBanner daysLeft={sub.trialDaysLeft} />}
          {children}
        </>
      )}
    </DashboardShell>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  upgradeTier,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  /** Feature not in the current plan — show which tier unlocks it (link still
   *  works; the page renders the upgrade pitch). */
  upgradeTier?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors no-underline"
    >
      <Icon size={17} className="shrink-0" />
      {label}
      {upgradeTier && <TierBadge tier={upgradeTier} />}
    </Link>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className="ml-auto text-[0.55rem] font-bold bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
      {tier}
    </span>
  );
}

function PlanBadge({ name, trialing }: { name: string; trialing: boolean }) {
  return (
    <Link
      href="/dashboard/billing"
      className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors no-underline"
      title="Ver mi plan y facturación"
    >
      {name}
      {trialing && ' · Prueba'}
    </Link>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    OWNER: "bg-emerald-50 text-emerald-700",
    ADMIN: "bg-blue-50 text-blue-700",
    STAFF: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    OWNER: "Dueño",
    ADMIN: "Gerente",
    STAFF: "Empleado",
  };
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${styles[role] ?? styles.STAFF}`}>
      {labels[role] ?? role}
    </span>
  );
}
