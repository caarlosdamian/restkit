"use client";

import { useState } from "react";
import { Power, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";

interface SessionData {
  id: string;
  staffName: string;
  openingBalance: number;
  startedAt: string;
  totalSales: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
}

interface POSSessionCloseProps {
  session: SessionData;
  onSessionClosed: () => void;
}

export default function POSSessionClose({ session, onSessionClosed }: POSSessionCloseProps) {
  const [closingBalance, setClosingBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cut, setCut] = useState<any>(null);

  async function handleCloseSession() {
    if (closingBalance === "" || Number(closingBalance) < 0) {
      setError("Ingresa un monto válido");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/pos-session/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingBalance: Number(closingBalance),
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al cerrar sesión");
        return;
      }

      setCut(data.cut);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (cut) {
    const expectedCash = cut.expectedCash;
    const actualCash = cut.actualCash;
    const variance = cut.variance;

    const hasVariance = variance !== 0;
    const isOverage = variance > 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                hasVariance && !isOverage ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
              }`}
            >
              {hasVariance && !isOverage ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />}
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold text-gray-900">Corte de caja</h1>
            <p className="text-sm text-gray-500">{cut.staffName}</p>
          </div>

          {/* Cash reconciliation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Dinero esperado</p>
              <p className="text-2xl font-extrabold text-gray-900">${expectedCash.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">
                ${cut.openingBalance.toFixed(2)} inicial + ${cut.cashSales.toFixed(2)} ventas
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Dinero real</p>
              <p className="text-2xl font-extrabold text-gray-900">${actualCash.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">Conteo en caja</p>
            </div>
          </div>

          {/* Variance */}
          <div
            className={`rounded-xl border-2 p-4 ${
              !hasVariance
                ? "bg-emerald-50 border-emerald-200"
                : isOverage
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  {!hasVariance ? "✓ Cuadre perfecto" : isOverage ? "Faltante" : "Sobrante"}
                </p>
                <p
                  className={`text-3xl font-extrabold ${
                    !hasVariance
                      ? "text-emerald-600"
                      : isOverage
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {variance > 0 ? "+" : ""}${Math.abs(variance).toFixed(2)}
                </p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>Diferencia</p>
                <p className="font-bold">{variance === 0 ? "0%" : `${((variance / expectedCash) * 100).toFixed(2)}%`}</p>
              </div>
            </div>
          </div>

          {/* Sales breakdown */}
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900">Ventas del día</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-600 font-semibold mb-1">💵 Efectivo</p>
                <p className="text-lg font-bold text-blue-900">${cut.cashSales.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-xs text-purple-600 font-semibold mb-1">💳 Tarjeta</p>
                <p className="text-lg font-bold text-purple-900">${cut.cardSales.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3">
                <p className="text-xs text-indigo-600 font-semibold mb-1">🔄 Transferencia</p>
                <p className="text-lg font-bold text-indigo-900">${cut.transferSales.toFixed(2)}</p>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-semibold">Total de ventas</p>
                <p className="text-lg font-bold text-gray-900">${cut.totalSales.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">{cut.totalOrders} órdenes</p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4">
            <div className="flex items-start gap-3">
              <TrendingUp size={18} className="text-indigo-600 mt-1 shrink-0" />
              <div className="text-sm text-indigo-900">
                <p className="font-bold mb-1">Resumen del turno</p>
                <p>
                  Se registraron <strong>{cut.totalOrders} órdenes</strong> por{" "}
                  <strong>${cut.totalSales.toFixed(2)}</strong> en ventas.{" "}
                  {!hasVariance
                    ? "La caja cuadra perfectamente."
                    : isOverage
                      ? `Hay $${variance.toFixed(2)} de sobrante.`
                      : `Hay $${Math.abs(variance).toFixed(2)} de faltante.`}
                </p>
              </div>
            </div>
          </div>

          {/* Done button */}
          <button
            onClick={onSessionClosed}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Power size={32} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold text-gray-900">Cerrar caja</h1>
          <p className="text-sm text-gray-500">Ingresa el dinero final en la caja</p>
        </div>

        {/* Session summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-600 uppercase">Dinero inicial</span>
            <span className="text-sm font-bold text-gray-900">${session.openingBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-600 uppercase">Ventas (efectivo)</span>
            <span className="text-sm font-bold text-gray-900">${session.cashSales.toFixed(2)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-600 uppercase">Esperado</span>
            <span className="text-lg font-extrabold text-gray-900">
              ${(session.openingBalance + session.cashSales).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Closing balance input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Dinero actual en caja <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              placeholder="0.00"
              disabled={loading}
              autoFocus
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej. Dinero extraído para compra, etc."
            disabled={loading}
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={handleCloseSession}
          disabled={!closingBalance || loading}
          className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Power size={16} />
          {loading ? "Procesando..." : "Cerrar caja"}
        </button>
      </div>
    </div>
  );
}
