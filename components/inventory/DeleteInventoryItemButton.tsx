"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteInventoryItemButton({ itemId, name }: { itemId: string; name: string }) {
  const router = useRouter();
  async function handleDelete() {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await fetch(`/api/inventory/${itemId}`, { method: "DELETE" });
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
