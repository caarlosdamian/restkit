import POSLoginPage from "@/components/pos/POSLoginPage";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function POSRootPage() {
  // Check if user is already logged in to POS via localStorage
  // (can't check server-side because it's client data)
  // If logged in, they'll be redirected by the client component

  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <POSLoginPage />
    </Suspense>
  );
}
