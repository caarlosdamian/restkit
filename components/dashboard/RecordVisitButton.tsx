"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";

export default function RecordVisitButton({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar visita");

      setMessage({
        text: data.earnedReward
          ? "¡Premio ganado! Reiniciando contador."
          : `Visita ${data.currentVisits} registrada.`,
        type: "success",
      });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
      >
        <ScanLine size={16} />
        {loading ? "Registrando..." : "Registrar Visita"}
      </button>
      {message && (
        <p className={`text-xs font-medium ${message.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
