"use client";

import { useState } from "react";
import { Sprout, AlertCircle, CheckCircle2, Smartphone } from "lucide-react";

interface SeedDataButtonProps {
  restaurantCode: string;
}

interface SeedResponse {
  success: boolean;
  data?: {
    staff: number;
    tables: number;
    products: number;
    customers: number;
    employeeNumbers: string[];
  };
  error?: string;
}

export default function SeedDataButton({ restaurantCode }: SeedDataButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [seedData, setSeedData] = useState<SeedResponse["data"]>(undefined);

  async function handleSeed() {
    if (!window.confirm("¿Crear datos de prueba? (Mesas, productos, clientes)")) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/restaurants/seed-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json() as SeedResponse;

      if (!res.ok) {
        setError(data.error || "Error al crear datos");
        return;
      }

      setSeedData(data.data || undefined);
      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Restaurant Code Display */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
          <Smartphone size={13} /> Código de Restaurante (para POS)
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-blue-200 font-mono font-bold text-blue-900 text-sm">
            {restaurantCode}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(restaurantCode);
              alert("Código copiado al portapapeles");
            }}
            className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
          >
            Copiar
          </button>
        </div>
        <p className="text-xs text-blue-700 mt-2">
          Comparte este código con tus empleados para acceder al sistema POS
        </p>
      </div>

      {/* Seed Data Button */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sprout size={18} className="text-emerald-600" />
          <p className="text-sm font-bold text-gray-900">Crear Datos de Prueba</p>
        </div>

        {success && seedData && (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0 flex-shrink-0" />
            <div className="text-sm text-emerald-700">
              <p className="font-semibold mb-1">Datos creados exitosamente</p>
              <ul className="text-xs space-y-0.5 ml-0">
                <li>• {seedData.staff} empleados (números: {seedData.employeeNumbers.join(", ")})</li>
                <li>• {seedData.tables} mesas</li>
                <li>• {seedData.products} productos</li>
                <li>• {seedData.customers} clientes</li>
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <p className="text-xs text-gray-600">
          Genera automáticamente mesas, menú y clientes de prueba para explorar el sistema.
        </p>

        <button
          onClick={handleSeed}
          disabled={loading || success}
          className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Sprout size={16} />
          {loading ? "Creando..." : success ? "¡Completado!" : "Crear Datos de Prueba"}
        </button>
      </div>
    </div>
  );
}
