"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function RemoveStaffButton({ staffId, name }: { staffId: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRemove() {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    try {
      await fetch(`/api/staff/${staffId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      title="Eliminar empleado"
    >
      <Trash2 size={15} />
    </button>
  );
}
