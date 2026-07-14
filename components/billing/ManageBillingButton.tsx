"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

/** Opens the Stripe Billing Portal (update card, change plan, cancel). */
export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo abrir el portal");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={open}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {loading ? "Abriendo…" : "Administrar facturación"}
        <ExternalLink size={14} />
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
