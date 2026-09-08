"use client";

import { useEffect, useState } from "react";
import { User, Loader2, X, Gift, Wallet, Plus } from "lucide-react";

export interface AttachedCustomer {
  id: string;
  name: string;
  phone?: string;
  mechanic: "sellos" | "cashback";
  stamps: number;
  required: number;
  rewardsPending: number;
  rewardDescription: string;
  unitPlural: string;
  cashbackBalance: number;
  cashbackRedeemable: boolean;
  cashbackThreshold: number;
  maxCashback: number;
}

interface Props {
  orderTotal: number;
  value: AttachedCustomer | null;
  onChange: (c: AttachedCustomer | null) => void;
}

const MXN = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Attaching the loyalty customer at the register. Four digits of a phone
 * number is enough to find someone within one business, and a walk-in with no
 * card yet is enrolled in the same gesture — no scanner, no app, and it works
 * on a fixed terminal with no camera.
 */
export default function CustomerAttach({ orderTotal, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AttachedCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = query.replace(/\D/g, "");
  // Only ever show matches for the digits currently typed, so a stale response
  // from a previous query can't flash results the cashier didn't ask for.
  const visible = digits.length >= 4 ? results.filter((r) => (r.phone ?? "").includes(digits)) : [];

  // Debounced lookup. Both setState calls happen asynchronously (inside the
  // timeout), never synchronously in the effect body — a synchronous one here
  // would cascade a second render on every keystroke.
  useEffect(() => {
    if (value || digits.length < 4) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/pos/customers/lookup?phone=${digits}&total=${orderTotal}`
        );
        const data = await res.json();
        if (!cancelled) setResults(res.ok ? data.results : []);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [digits, orderTotal, value]);

  async function enrol() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/customers/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, total: orderTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo dar de alta");
        return;
      }
      onChange(data);
      setQuery("");
    } finally {
      setCreating(false);
    }
  }

  if (value) {
    const short = Math.max(0, value.required - value.stamps);
    // After a mechanic switch the old side is frozen but still redeemable, so
    // it has to stay visible at the till — otherwise a customer's stamps
    // silently vanish and they can never claim what they already earned.
    const frozenStamps = value.mechanic === "cashback" && value.rewardsPending > 0;
    const frozenBalance = value.mechanic === "sellos" && value.cashbackRedeemable;
    return (
      <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <User size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-900 truncate">{value.name}</p>
            {value.mechanic === "sellos" ? (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                {value.rewardsPending > 0 ? (
                  <>
                    <Gift size={12} />
                    <span className="font-semibold">¡Premio listo!</span>
                  </>
                ) : (
                  <>
                    <span className="tracking-tight">
                      {"●".repeat(value.stamps)}
                      {"○".repeat(Math.max(0, value.required - value.stamps))}
                    </span>
                    {/* Telling the waiter how close they are is the point — it
                        turns the lookup into a reason to mention it. */}
                    <span>
                      {short === 1
                        ? `le falta 1 ${value.unitPlural.replace(/s$/, "")}`
                        : `le faltan ${short}`}
                    </span>
                  </>
                )}
              </p>
            ) : (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                <Wallet size={12} />
                Saldo {MXN(value.cashbackBalance)}
                {!value.cashbackRedeemable && value.cashbackBalance > 0 && (
                  <span className="text-emerald-600/70">
                    · faltan {MXN(value.cashbackThreshold - value.cashbackBalance)}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={() => onChange(null)}
            title="Quitar cliente"
            className="shrink-0 text-emerald-600 hover:text-emerald-800"
          >
            <X size={17} />
          </button>
        </div>

        {(frozenStamps || frozenBalance) && (
          <p className="mt-2 pt-2 border-t border-emerald-200/70 text-xs text-emerald-700 flex items-center gap-1.5">
            <Gift size={12} className="shrink-0" />
            {frozenStamps
              ? `También tiene un premio pendiente: ${value.rewardDescription}`
              : `También tiene ${MXN(value.cashbackBalance)} de saldo por usar`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
        Cliente <span className="font-medium normal-case tracking-normal text-gray-400">(opcional)</span>
      </label>
      <div className="relative">
        <input
          inputMode="numeric"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Teléfono — 4 dígitos bastan"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        {searching && (
          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      {digits.length >= 4 && (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {visible.map((c) => (
            <button
              key={c.id}
              onClick={() => onChange(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-500">
                  {c.mechanic === "sellos"
                    ? `${c.stamps}/${c.required}${c.rewardsPending > 0 ? " · ¡premio listo!" : ""}`
                    : `Saldo ${MXN(c.cashbackBalance)}`}
                </p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{c.phone?.slice(-4)}</span>
            </button>
          ))}

          {digits.length >= 10 && !visible.some((r) => r.phone === digits) && (
            <button
              onClick={enrol}
              disabled={creating}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-700">Dar de alta {digits}</p>
                <p className="text-xs text-gray-500">Se lleva su tarjeta en el ticket</p>
              </div>
            </button>
          )}

          {visible.length === 0 && digits.length < 10 && !searching && (
            <p className="px-3 py-2.5 text-xs text-gray-400">
              Sin coincidencias — escribe los 10 dígitos para dar de alta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
