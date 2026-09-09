import type { MetadataRoute } from "next";

/**
 * Android's "add to home screen" reads its icon from here, not from the
 * <link rel="icon"> tags — without a manifest it scales the 180px Apple icon
 * and gets a soft one. Customers reach `/c/<token>` from a printed QR on a
 * phone, so that path is worth getting right.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RestKit — El sistema operativo para restaurantes",
    short_name: "RestKit",
    description:
      "POS, cocina, inventario, analíticas y fidelización digital para restaurantes en México.",
    lang: "es-MX",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // The brand emerald, same value the nav mark and the card ground use.
    theme_color: "#10b981",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
