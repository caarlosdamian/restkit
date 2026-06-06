"use client";

import { useState } from "react";
import { Wand2, CheckCircle2, AlertCircle } from "lucide-react";

export default function SeedButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleSeed() {
    if (!confirm("¿Generar datos de prueba? Esto creará mesas, empleados, productos y clientes.")) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al generar datos");
        return;
      }

      setResult(data);
      // Refresh page after 2 seconds
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">¡Datos creados exitosamente!</p>
            <p className="text-sm text-emerald-700 mt-1">
              Se crearon {result.summary.staff} empleados, {result.summary.tables} mesas,{" "}
              {result.summary.products} productos y {result.summary.customers} clientes.
            </p>
            <p className="text-xs text-emerald-600 mt-2">Recargar en 2 segundos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-blue-900">Generar datos de prueba</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Crea empleados, mesas, productos y clientes para probar la app.
          </p>
        </div>
        <button
          onClick={handleSeed}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-semibold disabled:opacity-50 transition-colors shrink-0"
        >
          <Wand2 size={16} />
          {loading ? "Creando..." : "Generar"}
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
