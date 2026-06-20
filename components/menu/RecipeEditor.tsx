"use client";

import { Plus, Trash2 } from "lucide-react";

export interface RecipeLine {
  inventoryItemId: string;
  quantity: number;
}

export interface InventoryItemOption {
  id: string;
  name: string;
  unit: string;
}

export default function RecipeEditor({
  inventoryItems,
  lines,
  onChange,
}: {
  inventoryItems: InventoryItemOption[];
  lines: RecipeLine[];
  onChange: (lines: RecipeLine[]) => void;
}) {
  function addLine() {
    if (inventoryItems.length === 0) return;
    onChange([...lines, { inventoryItemId: inventoryItems[0].id, quantity: 1 }]);
  }

  function updateLine(index: number, patch: Partial<RecipeLine>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
          Receta (opcional)
        </label>
        {inventoryItems.length > 0 && (
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <Plus size={13} /> Agregar ingrediente
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-2">
        Qué se descuenta del inventario cada vez que se vende una unidad. Déjalo vacío si este producto no consume inventario.
      </p>

      {inventoryItems.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No hay artículos de inventario registrados todavía.</p>
      ) : (
        <div className="space-y-2">
          {lines.map((line, i) => {
            const item = inventoryItems.find((opt) => opt.id === line.inventoryItemId);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={line.inventoryItemId}
                  onChange={(e) => updateLine(i, { inventoryItemId: e.target.value })}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  {inventoryItems.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  className="w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <span className="text-xs text-gray-400 w-10 shrink-0">{item?.unit}</span>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
