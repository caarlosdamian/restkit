"use client";

import { useEffect } from "react";

export default function POSContainer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Hide sidebar and take full width for POS view
    const sidebar = document.querySelector("[data-sidebar]");
    const mainContent = document.querySelector("[data-main-content]");

    if (sidebar) sidebar.classList.add("hidden");
    if (mainContent) {
      mainContent.classList.remove("lg:ml-64");
      mainContent.classList.add("w-full");
    }

    return () => {
      if (sidebar) sidebar.classList.remove("hidden");
      if (mainContent) {
        mainContent.classList.add("lg:ml-64");
        mainContent.classList.remove("w-full");
      }
    };
  }, []);

  return <>{children}</>;
}
