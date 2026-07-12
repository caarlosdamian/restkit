import type { Metadata } from "next";

export const metadata: Metadata = {
  // `absolute` opts out of the root "%s · RestKit" template — the POS terminal
  // is its own surface and shouldn't read "RestKit POS · RestKit".
  title: { absolute: "RestKit POS — Terminal de venta" },
  description: "Terminal de punto de venta: mesas, órdenes, cocina y cobro.",
};

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
