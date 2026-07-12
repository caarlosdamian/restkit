"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

const SECTIONS = ["Comedor", "Terraza", "Barra", "Patio", "VIP"];

export default function TableForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: Number(fd.get("number")),
          name: (fd.get("name") as string)?.trim() || undefined,
          capacity: Number(fd.get("capacity") || 4),
          section: (fd.get("section") as string)?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm"
      >
        <Plus size={15} /> Nueva Mesa
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-7">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold text-gray-900">Nueva Mesa</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Número <span className="text-red-500">*</span>
              </label>
              <input
                name="number"
                type="number"
                min={1}
                step={1}
                required
                placeholder="Ej. 1"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Capacidad
              </label>
              <input
                name="capacity"
                type="number"
                min={1}
                step={1}
                defaultValue={4}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Nombre
            </label>
            <input
              name="name"
              placeholder="Ej. Mesa 1 (por defecto)"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Sección
            </label>
            <input
              name="section"
              list="section-options"
              placeholder="Ej. Comedor"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            <datalist id="section-options">
              {SECTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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
              {loading ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
