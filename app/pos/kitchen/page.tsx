"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import KitchenDisplay from "@/components/pos/KitchenDisplay";

export default function POSKitchenPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Display-only gate — the kitchen feed APIs derive identity from the
    // terminal session cookie, never from this stored snapshot.
    (async () => {
      if (!window.localStorage.getItem("posEmployeeSession")) {
        router.push("/pos");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-neutral-500">
        Cargando…
      </div>
    );
  }

  return <KitchenDisplay />;
}
