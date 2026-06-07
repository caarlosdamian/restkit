"use client";

import { useState } from "react";
import { Delete, AlertCircle, User } from "lucide-react";
import { setActiveWaiter } from "@/lib/waiter-session";

interface WaiterPinModalProps {
  tableName: string;
  /** Show a "continue as manager" escape hatch (no PIN, attributes to the
   *  logged-in terminal user). Useful while not every staff has a PIN yet. */
  allowManager?: boolean;
  onAuthenticated: (waiter: { staffId: string; staffName: string } | null) => void;
}

const MAX_LEN = 6;

export default function WaiterPinModal({
  tableName,
  allowManager = true,
  onAuthenticated,
}: WaiterPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(value: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pos/waiter/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "PIN incorrecto");
        setPin("");
        return;
      }
      setActiveWaiter(data.staffId, data.staffName, data.token);
      onAuthenticated({ staffId: data.staffId, staffName: data.staffName });
    } catch {
      setError("Error de conexión");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function press(digit: string) {
    if (loading) return;
    setError("");
    const next = (pin + digit).slice(0, MAX_LEN);
    setPin(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl p-7 space-y-5">
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-2">
            <User size={26} />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900">¿Quién toma la orden?</h2>
          <p className="text-sm text-gray-500">{tableName} · ingresa tu PIN</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-2.5 h-4">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i < pin.length ? "bg-amber-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-sm text-red-600">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              disabled={loading}
              className="aspect-square rounded-2xl bg-gray-50 text-2xl font-bold text-gray-900 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => setPin((p) => p.slice(0, -1))}
            disabled={loading || pin.length === 0}
            className="aspect-square rounded-2xl bg-gray-50 text-gray-500 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40"
          >
            <Delete size={22} />
          </button>
          <button
            onClick={() => press("0")}
            disabled={loading}
            className="aspect-square rounded-2xl bg-gray-50 text-2xl font-bold text-gray-900 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={() => submit(pin)}
            disabled={loading || pin.length < 4}
            className="aspect-square rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-40"
          >
            {loading ? "…" : "OK"}
          </button>
        </div>

        {allowManager && (
          <button
            onClick={() => onAuthenticated(null)}
            disabled={loading}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
          >
            Continuar como gerente
          </button>
        )}
      </div>
    </div>
  );
}
