"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { readJson } from "@/lib/api-client";
import {
  PLANS,
  priceFor,
  formatMXN,
  ANNUAL_DISCOUNT,
  type BillingPeriod,
} from "@/lib/plans";

/**
 * Plan chooser on the billing page. Each plan starts a Stripe Checkout
 * session and redirects to the hosted page.
 */
export default function BillingPlans({
  currentPlan,
  defaultPeriod = "monthly",
}: {
  currentPlan?: string;
  defaultPeriod?: BillingPeriod;
}) {
  const [period, setPeriod] = useState<BillingPeriod>(defaultPeriod);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function choose(plan: string) {
    setLoadingPlan(plan);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      });
      const { data, error: failure } = await readJson<{ url?: string }>(res);
      if (failure) throw new Error(failure);
      if (!data?.url) throw new Error("No se pudo iniciar el pago");
      window.location.assign(data.url); // Stripe-hosted checkout
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el pago");
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {/* Monthly / annual toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p === "monthly" ? "Mensual" : "Anual"}
              {p === "annual" && (
                <span className="ml-1.5 text-[0.7rem] font-bold text-emerald-600">
                  -{Math.round(ANNUAL_DISCOUNT * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {PLANS.map((p) => {
          const price = priceFor(p, period);
          const isCurrent = p.id === currentPlan;

          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-6 relative ${
                p.highlight ? "border-emerald-500 shadow-lg shadow-emerald-500/10" : "border-gray-200"
              } bg-white`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[0.7rem] font-bold px-3 py-1 rounded-full">
                  Más popular
                </span>
              )}
              <p className="text-sm font-bold text-gray-900 mb-1">{p.name}</p>
              <div className="flex items-end gap-1 mb-4 min-h-[2.75rem]">
                <span className="text-3xl font-extrabold tracking-tight text-gray-900">
                  {formatMXN(price)}
                </span>
                <span className="text-sm text-gray-400 mb-1">/mes</span>
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={14} className="text-emerald-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="block w-full text-center rounded-xl py-2.5 text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Plan actual
                </span>
              ) : (
                <button
                  onClick={() => choose(p.id)}
                  disabled={loadingPlan !== null}
                  className={`block w-full text-center rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    p.highlight
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-gray-700"
                  }`}
                >
                  {loadingPlan === p.id ? "Redirigiendo…" : "Elegir este plan"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
