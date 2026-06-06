"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

export default function StaffLoginForm() {
  const router = useRouter();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber: employeeNumber.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Número de empleado no válido");
        return;
      }

      const data = await res.json();
      // Store staff session locally
      localStorage.setItem("staffSession", JSON.stringify({
        staffId: data.staffId,
        staffName: data.staffName,
      }));
      router.push("/dashboard/pos/staff-view");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Input */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
          Número de empleado
        </label>
        <input
          type="text"
          placeholder="Ej. 001, 123, EMP-001"
          value={employeeNumber}
          onChange={(e) => setEmployeeNumber(e.target.value)}
          disabled={loading}
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg font-semibold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!employeeNumber.trim() || loading}
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Verificando..." : "Continuar"}
      </button>
    </form>
  );
}
