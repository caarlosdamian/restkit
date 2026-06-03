"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-red-600 hover:text-red-500 font-medium"
    >
      Cerrar sesión
    </button>
  );
}
