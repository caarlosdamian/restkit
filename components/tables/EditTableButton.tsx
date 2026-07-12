"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

const SECTIONS = ["Comedor", "Terraza", "Barra", "Patio", "VIP"];

interface TableData {
  id: string;
  number: number;
  name?: string;
  capacity: number;
  section?: string;
}

export default function EditTableButton({ table }: { table: TableData }) {
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
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PATCH",
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        title="Editar mesa"
      >
        <Pencil size={15} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-7">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-gray-900">Editar Mesa</h2>
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
                    defaultValue={table.number}
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
                    defaultValue={table.capacity}
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
                  defaultValue={table.name}
                  placeholder={`Mesa ${table.number}`}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Sección
                </label>
                <input
                  name="section"
                  list="section-options-edit"
                  defaultValue={table.section}
                  placeholder="Ej. Comedor"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <datalist id="section-options-edit">
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
                  {loading ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
