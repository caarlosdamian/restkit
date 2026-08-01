"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  PLANS,
  priceFor,
  formatMXN,
  ANNUAL_DISCOUNT,
  type BillingPeriod,
} from "@/lib/plans";

export default function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <section className="py-24" id="precios">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-10">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-600">Precios</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-2 mb-3">
            Transparente, sin sorpresas
          </h2>
          <p className="text-base text-gray-500">14 días de prueba gratis. Sin tarjeta de crédito.</p>
        </div>

        {/* Monthly / annual toggle */}
        <div className="flex justify-center mb-12">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {PLANS.map((p) => {
            const price = priceFor(p, period);
            const href = `/registro?plan=${p.id}&period=${period}`;

            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-8 relative ${
                  p.highlight ? "border-emerald-500 shadow-lg shadow-emerald-500/10 bg-white" : "border-gray-200 bg-white"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[0.7rem] font-bold px-3 py-1 rounded-full">
                    Más popular
                  </span>
                )}
                <p className="text-sm font-bold text-gray-900 mb-1">{p.name}</p>
                <div className="flex items-end gap-1 mb-1 min-h-[2.75rem]">
                  <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                    {formatMXN(price)}
                  </span>
                  <span className="text-sm text-gray-400 mb-1">/mes</span>
                </div>
                <p className="text-xs text-gray-400 mb-6 min-h-[2rem]">
                  {period === "annual" ? `Facturado anual · ${p.desc}` : p.desc}
                </p>
                <ul className="space-y-2.5 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`block w-full text-center rounded-xl py-2.5 text-sm font-semibold transition-colors no-underline ${
                    p.highlight
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-gray-700"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
