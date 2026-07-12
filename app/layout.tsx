import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "RestKit — El sistema operativo para restaurantes",
    template: "%s · RestKit",
  },
  description:
    "POS, pantalla de cocina, inventario con recetas, analíticas, facturación CFDI 4.0 y fidelización digital — todo integrado en un solo panel, hecho para restaurantes en México.",
  applicationName: "RestKit",
  keywords: [
    "POS restaurante",
    "punto de venta",
    "pantalla de cocina",
    "KDS",
    "inventario de restaurante",
    "recetas",
    "CFDI 4.0",
    "facturación SAT",
    "fidelización digital",
    "Apple Wallet",
    "Google Wallet",
    "México",
  ],
  openGraph: {
    type: "website",
    siteName: "RestKit",
    locale: "es_MX",
    url: "/",
    title: "RestKit — El sistema operativo para restaurantes",
    description:
      "Un ecosistema completo en lugar de 6 herramientas distintas: POS, cocina, inventario, analíticas, facturación CFDI y fidelización, todo conectado.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
