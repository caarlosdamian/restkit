"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteTableButton({ tableId, name }: { tableId: string; name: string }) {
  const router = useRouter();
  async function handleDelete() {
    if (!confirm(`¿Eliminar "${name}"? Dejará de aparecer en el POS. No afecta órdenes ya registradas.`)) return;
    await fetch(`/api/tables/${tableId}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <button
      onClick={handleDelete}
      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
      title="Eliminar"
    >
      <Trash2 size={15} />
    </button>
  );
}
