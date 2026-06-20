"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, X } from "lucide-react";

const TYPES = [
  { value: "RESTOCK", label: "Entrada / Restock", hint: "Llegó mercancía nueva" },
  { value: "WASTE", label: "Merma", hint: "Se dañó, caducó o se desperdició" },
  { value: "ADJUSTMENT", label: "Ajuste", hint: "Corrección de conteo (puede ser + o -)" },
] as const;

interface InventoryItemLite {
  id: string;
  name: string;
  unit: string;
}

export default function StockAdjustButton({ item }: { item: InventoryItemLite }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("RESTOCK");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const rawQty = Number(fd.get("quantity") || 0);
    if (rawQty === 0) {
      setError("La cantidad no puede ser 0");
      setLoading(false);
      return;
    }
    const delta = type === "ADJUSTMENT" ? rawQty : Math.abs(rawQty);

    try {
      const res = await fetch(`/api/inventory/${item.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, delta, note: fd.get("note") || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al ajustar inventario");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ajustar inventario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
        title="Ajustar stock"
      >
        <PackagePlus size={15} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-7">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-extrabold text-gray-900">Ajustar Stock</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">{item.name}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Tipo de movimiento
                </label>
                <div className="space-y-2">
                  {TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-all ${
                        type === t.value
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="movementType"
                        value={t.value}
                        checked={type === t.value}
                        onChange={() => setType(t.value)}
                        className="mt-0.5 accent-emerald-500"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-800">{t.label}</span>
                        <span className="block text-xs text-gray-500">{t.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Cantidad ({item.unit}) <span className="text-red-500">*</span>
                </label>
                <input
                  name="quantity"
                  type="number"
                  step="any"
                  required
                  placeholder={type === "ADJUSTMENT" ? "Ej. -3 o 5" : "Ej. 10"}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                {type !== "ADJUSTMENT" && (
                  <p className="text-xs text-gray-400 mt-1">
                    Se aplicará como {type === "RESTOCK" ? "entrada (+)" : "salida (-)"} sin importar el signo.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nota
                </label>
                <input
                  name="note"
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {loading ? "Guardando…" : "Aplicar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
