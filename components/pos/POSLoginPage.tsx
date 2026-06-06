"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, AlertCircle, UtensilsCrossed } from "lucide-react";

export default function POSLoginPage() {
  const router = useRouter();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [restaurantCode, setRestaurantCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already logged in to POS
  useEffect(() => {
    const posSession = window.localStorage.getItem("posEmployeeSession");
    if (posSession) {
      router.push("/pos/dashboard");
    }
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Get restaurant code from window.localStorage if available
      // Or use the code entered if this is the first time
      const code = restaurantCode || window.localStorage.getItem("restaurantCode");

      if (!code) {
        setError("Se requiere un código de restaurante");
        setLoading(false);
        return;
      }

      // Call API to validate employee number
      const res = await fetch("/api/pos/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNumber: employeeNumber.trim(),
          restaurantCode: code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Empleado no encontrado");
        setLoading(false);
        return;
      }

      // Store POS session (separate from admin session)
      window.localStorage.setItem(
        "posEmployeeSession",
        JSON.stringify({
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          employeeNumber: data.employeeNumber,
          businessId: data.businessId,
          role: data.role,
        })
      );

      // Store restaurant code for future logins
      if (restaurantCode) {
        window.localStorage.setItem("restaurantCode", code);
      }

      router.push("/pos/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al conectar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <UtensilsCrossed size={40} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">RestKit</h1>
          <p className="text-sm text-gray-600 mt-1">Sistema de Punto de Venta</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-white shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-gray-900">Inicia Sesión</h2>
            <p className="text-sm text-gray-500 mt-1">Ingresa con tu número de empleado</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Restaurant Code */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Código del Restaurante
              </label>
              <input
                type="text"
                value={restaurantCode}
                onChange={(e) => setRestaurantCode(e.target.value.toUpperCase())}
                placeholder="Ej. REST-001"
                disabled={loading || !!window.localStorage.getItem("restaurantCode")}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-center text-lg font-semibold text-gray-900 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">
                {window.localStorage.getItem("restaurantCode")
                  ? `Restaurante: ${window.localStorage.getItem("restaurantCode")}`
                  : "Tu gerente te proporcionará este código"}
              </p>
            </div>

            {/* Employee Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Número de Empleado <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="Ej. 001, 002, 003..."
                disabled={loading}
                autoFocus
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-center text-lg font-bold text-gray-900 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3">
                <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!employeeNumber.trim() || loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <LogIn size={18} />
              {loading ? "Validando..." : "Entrar al POS"}
            </button>
          </form>

          {/* Info */}
          <div className="space-y-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900">📋 Cómo funciona:</p>
            <ul className="text-xs text-amber-800 space-y-1.5">
              <li className="flex gap-2">
                <span className="shrink-0">1.</span>
                <span>Tu gerente te dará un código de restaurante</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">2.</span>
                <span>Ingresa tu número de empleado</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">3.</span>
                <span>Accede al sistema POS</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          ¿Eres propietario? <a href="/login" className="font-semibold text-amber-600 hover:underline">Ir a administrador</a>
        </p>
      </div>
    </div>
  );
}
