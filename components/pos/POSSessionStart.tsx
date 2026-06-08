"use client";

import { useState } from "react";
import { Power, AlertCircle, Lightbulb } from "lucide-react";

interface POSSessionStartProps {
  employeeNumber?: string;
  employeeName: string;
  onSessionStarted: (sessionId: string) => void;
}

export default function POSSessionStart({
  employeeNumber,
  employeeName,
  onSessionStarted,
}: POSSessionStartProps) {
  const [openingBalance, setOpeningBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStartSession() {
    if (!openingBalance || Number(openingBalance) < 0) {
      setError("Ingresa un monto válido");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/pos-session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingBalance: Number(openingBalance),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al abrir sesión");
        return;
      }

      onSessionStarted(data.sessionId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Power size={32} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold text-gray-900">Abrir caja</h1>
          <p className="text-sm text-gray-500">
            Ingresa el dinero inicial en la caja registradora
          </p>
        </div>

        {/* Employee info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Empleado</p>
          <p className="text-sm font-semibold text-gray-900">
            {employeeName}
            {employeeNumber && <span className="text-gray-400 font-normal"> #{employeeNumber}</span>}
          </p>
        </div>

        {/* Opening balance input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Dinero inicial en caja <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              disabled={loading}
              autoFocus
              className="w-full pl-8 pr-4 py-3.5 rounded-xl border border-gray-200 text-xl font-bold text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Quick amount buttons */}
        <div className="grid grid-cols-3 gap-2">
          {[50, 100, 200].map((amount) => (
            <button
              key={amount}
              onClick={() => setOpeningBalance(String(amount))}
              disabled={loading}
              className="py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-base font-bold text-gray-700 disabled:opacity-50 active:scale-95 transition-all"
            >
              ${amount}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStartSession}
          disabled={!openingBalance || loading}
          className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Power size={18} />
          {loading ? "Abriendo caja..." : "Abrir caja"}
        </button>

        {/* Info */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
          <p className="flex items-center gap-1.5 font-semibold mb-1">
            <Lightbulb size={14} /> Importante:
          </p>
          <p>Cuenta el dinero en la caja y ingresa el monto exacto. Se usará para conciliar al cierre.</p>
        </div>
      </div>
    </div>
  );
}
