import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Business from "@/models/Business";
import dbConnect from "@/lib/db";
import { evaluateSubscription } from "@/lib/subscription";
import { billingService } from "@/services/billing.service";
import { getPlan, type BillingPeriod } from "@/lib/plans";
import BillingPlans from "@/components/billing/BillingPlans";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(d);

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  // Billing is the owner's responsibility.
  if (session.user.role !== "OWNER") redirect("/dashboard");

  const { checkout } = await searchParams;

  await dbConnect();
  let business = session.user.businessId
    ? await Business.findById(session.user.businessId).select("subscription")
    : null;
  let sub = business?.subscription;

  // Reconcile with Stripe when the webhook may not have landed yet: on return
  // from checkout, or when we have a customer but no recorded subscription
  // (self-heals local dev / missed webhooks so a purchased plan isn't stuck
  // showing "trialing"). Best-effort — never block the page.
  const shouldReconcile =
    !!sub?.stripeCustomerId && (checkout === "success" || !sub.stripeSubscriptionId);
  if (shouldReconcile) {
    try {
      await billingService.syncSubscriptionFromStripe(sub!.stripeCustomerId!);
      business = await Business.findById(session.user.businessId).select("subscription");
      sub = business?.subscription;
    } catch (err) {
      console.error("Stripe reconcile failed", err);
    }
  }

  const view = evaluateSubscription(sub);
  const plan = getPlan(sub?.plan);
  const hasStripeCustomer = !!sub?.stripeCustomerId;

  const periodLabel: Record<BillingPeriod, string> = { monthly: "mensual", annual: "anual" };
  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const trialEnd = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const renews = periodEnd ? fmtDate(periodEnd) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Suscripción</h1>
        <p className="text-sm text-gray-500 mt-0.5">Administra tu plan y facturación.</p>
      </div>

      {/* Checkout return messages */}
      {checkout === "success" && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm font-medium text-emerald-800">
            ¡Listo! Tu suscripción se está activando. Puede tardar unos segundos en reflejarse.
          </p>
        </div>
      )}
      {checkout === "cancel" && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">Cancelaste el pago. Puedes elegir un plan cuando quieras.</p>
        </div>
      )}

      {/* Current status */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Estado actual</p>
        {view.status === "active" && (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                Suscripción activa{plan ? ` · Plan ${plan.name}` : ""}
                {sub?.billingPeriod ? ` (${periodLabel[sub.billingPeriod]})` : ""}
              </p>
              {renews && <p className="text-sm text-gray-500 mt-0.5">Se renueva el {renews}.</p>}
            </div>
          </div>
        )}
        {view.status === "trialing" && view.subscribed && (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                Plan {plan?.name ?? sub?.plan} activo · en periodo de prueba
                {sub?.billingPeriod ? ` (${periodLabel[sub.billingPeriod]})` : ""}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                Ya contrataste un plan. {trialEnd ? `Tu prueba termina el ${fmtDate(trialEnd)} y ` : ""}
                el primer cobro se hará al finalizar la prueba.
              </p>
            </div>
          </div>
        )}
        {view.status === "trialing" && !view.subscribed && (
          <div className="flex items-start gap-3">
            <Clock size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                Prueba gratuita · {view.trialDaysLeft} día{view.trialDaysLeft === 1 ? "" : "s"} restante
                {view.trialDaysLeft === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                Elige un plan para no perder acceso cuando termine tu prueba.
              </p>
            </div>
          </div>
        )}
        {(view.status === "past_due" || view.status === "canceled") && (
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                {view.status === "past_due" ? "Pago pendiente" : "Suscripción cancelada"}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">Reactiva tu suscripción para seguir usando RestKit.</p>
            </div>
          </div>
        )}
        {view.status === "none" && (
          <p className="text-sm text-gray-500">Aún no tienes una suscripción configurada.</p>
        )}

        {hasStripeCustomer && (
          <div className="mt-5">
            <ManageBillingButton />
          </div>
        )}
      </div>

      {/* Plan chooser */}
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">
          {view.subscribed ? "Cambiar de plan" : "Elige tu plan"}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Facturación segura con Stripe. Puedes cancelar cuando quieras.
        </p>
        <BillingPlans
          currentPlan={view.subscribed ? sub?.plan : undefined}
          defaultPeriod={sub?.billingPeriod ?? "monthly"}
        />
      </div>
    </div>
  );
}
