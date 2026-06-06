"use client";

import { useState } from "react";
import { Save, RotateCcw, Trash2 } from "lucide-react";

interface TableData {
  id: string;
  number: number;
  name?: string;
  capacity: number;
  position?: { x: number; y: number };
  section?: string;
  assignedStaffId?: string;
}

interface StaffMember {
  id: string;
  name: string;
}

const GRID_SIZE = 20;
const TABLE_SIZE = 60;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export default function TableLayoutEditor({ tables, staff }: { tables: TableData[]; staff: StaffMember[] }) {
  const [tableList, setTableList] = useState<TableData[]>(tables);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleTableDrag(id: string, e: React.DragEvent<HTMLDivElement>) {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(CANVAS_WIDTH - TABLE_SIZE, e.clientX - rect.left - TABLE_SIZE / 2));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - TABLE_SIZE, e.clientY - rect.top - TABLE_SIZE / 2));

    setTableList((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, position: { x: Math.round(x / GRID_SIZE) * GRID_SIZE, y: Math.round(y / GRID_SIZE) * GRID_SIZE } }
          : t
      )
    );
    setSaved(false);
  }

  function handleCapacityChange(id: string, capacity: number) {
    setTableList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, capacity: Math.max(1, capacity) } : t))
    );
    setSaved(false);
  }

  function handleSectionChange(id: string, section: string) {
    setTableList((prev) => prev.map((t) => (t.id === id ? { ...t, section } : t)));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/tables/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: tableList.map((t) => ({
            tableId: t.id,
            position: t.position,
            capacity: t.capacity,
            section: t.section,
            assignedStaffId: t.assignedStaffId || null,
          })),
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setTableList(tables);
    setSaved(false);
  }

  const sections = Array.from(new Set(tableList.map((t) => t.section).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar layout"}
        </button>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <RotateCcw size={16} />
          Reiniciar
        </button>
        <span className="text-sm text-gray-500 ml-auto">{tableList.length} mesas</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div
              className="bg-gray-50 border-b border-gray-200 p-4"
              style={{
                backgroundImage: `
                  linear-gradient(0deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent),
                  linear-gradient(90deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent)
                `,
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                position: "relative",
                overflow: "hidden",
              } as any}
            >
              {tableList.map((table) => {
                const x = table.position?.x ?? 0;
                const y = table.position?.y ?? 0;
                const isSelected = selectedId === table.id;

                return (
                  <div
                    key={table.id}
                    draggable
                    onDragEnd={(e) => handleTableDrag(table.id, e as any)}
                    onClick={() => setSelectedId(table.id)}
                    className={`absolute rounded-lg flex flex-col items-center justify-center cursor-move transition-all ${
                      isSelected
                        ? "ring-2 ring-emerald-500 bg-emerald-50 shadow-lg"
                        : "bg-white border-2 border-gray-200 hover:border-emerald-300 shadow"
                    }`}
                    style={{
                      left: x,
                      top: y,
                      width: TABLE_SIZE,
                      height: TABLE_SIZE,
                    }}
                  >
                    <span className="text-lg font-bold text-gray-900">{table.number}</span>
                    <span className="text-xs text-gray-500">{table.capacity} pers.</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel — table properties */}
        <div className="space-y-4">
          {selectedId ? (
            (() => {
              const table = tableList.find((t) => t.id === selectedId);
              if (!table) return null;

              return (
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-2">Mesa {table.number}</p>
                    <input
                      type="text"
                      placeholder="Nombre personalizado"
                      value={table.name || ""}
                      onChange={(e) => {
                        setTableList((prev) =>
                          prev.map((t) => (t.id === selectedId ? { ...t, name: e.target.value } : t))
                        );
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Capacidad</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCapacityChange(selectedId, table.capacity - 1)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={table.capacity}
                        onChange={(e) => handleCapacityChange(selectedId, parseInt(e.target.value) || 1)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-center font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        onClick={() => handleCapacityChange(selectedId, table.capacity + 1)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Sección</label>
                    <select
                      value={table.section || ""}
                      onChange={(e) => handleSectionChange(selectedId, e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="">Sin sección</option>
                      {sections.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="new">+ Agregar nueva sección</option>
                    </select>
                    {table.section && (
                      <input
                        type="text"
                        value={table.section}
                        placeholder="Ej. Bar, Patio, VIP"
                        onChange={(e) => handleSectionChange(selectedId, e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm mt-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Asignado a</label>
                    <select
                      value={table.assignedStaffId || ""}
                      onChange={(e) => {
                        setTableList((prev) =>
                          prev.map((t) =>
                            t.id === selectedId
                              ? { ...t, assignedStaffId: e.target.value || undefined }
                              : t
                          )
                        );
                        setSaved(false);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="">Sin asignar</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      setTableList((prev) => prev.filter((t) => t.id !== selectedId));
                      setSelectedId(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold transition-colors"
                  >
                    <Trash2 size={14} />
                    Eliminar mesa
                  </button>
                </div>
              );
            })()
          ) : (
            <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-500">Selecciona una mesa para editar</p>
            </div>
          )}

          {/* Sections summary */}
          {sections.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-600 uppercase mb-3">Secciones</p>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{section}</span>
                    <span className="text-gray-400">
                      {tableList.filter((t) => t.section === section).length} mesas
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
