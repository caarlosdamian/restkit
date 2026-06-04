"use client";

import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function ToggleAvailableButton({
  productId,
  isAvailable,
}: {
  productId: string;
  isAvailable: boolean;
}) {
  const router = useRouter();
  async function toggle() {
    await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !isAvailable }),
    });
    router.refresh();
  }
  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-lg transition-colors ${
        isAvailable
          ? "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
          : "text-emerald-500 hover:bg-emerald-50"
      }`}
      title={isAvailable ? "Deshabilitar" : "Habilitar"}
    >
      {isAvailable ? <Eye size={15} /> : <EyeOff size={15} />}
    </button>
  );
}
