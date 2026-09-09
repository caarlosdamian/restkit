import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VERTICALS } from "@/lib/verticals";
import SiteNav from "@/components/landing/SiteNav";
import SiteFooter from "@/components/landing/SiteFooter";

export const metadata: Metadata = {
  title: "Programas de lealtad por giro | RestKit",
  description:
    "Tarjetas de lealtad digitales en Apple Wallet y Google Wallet para restaurantes, cafeterías, barberías, spas, gimnasios y más. Sin apps ni plásticos.",
  alternates: { canonical: "/lealtad" },
};

export default function LealtadHub() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <SiteNav isAuthenticated={false} panelHref="/dashboard" />

      <section className="border-b border-gray-100 py-16 lg:py-20">
        <div className="mx-auto max-w-[820px] px-6">
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl">
            Lealtad digital, según tu giro
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            La mecánica que funciona en una cafetería no es la que funciona en un
            spa. Elige tu giro y te decimos cuál conviene y por qué.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {VERTICALS.map((v) => (
            <Link
              key={v.slug}
              href={`/lealtad/${v.slug}`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 no-underline transition-shadow hover:shadow-md"
            >
              <span
                className="inline-block rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${v.accent}14`, color: v.accent }}
              >
                {v.mechanic === "cashback" ? "Cashback" : "Sellos"}
              </span>
              <h2 className="mt-3 text-base font-bold tracking-tight text-gray-900">
                Programa de lealtad para {v.plural}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{v.tagline}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                Ver cómo <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
