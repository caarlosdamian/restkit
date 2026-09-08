import Link from "next/link";
import { Heart } from "lucide-react";
import VerticalLinks from "./VerticalLinks";

/** Shared by the home page and every vertical landing page. Carries the
 *  vertical index, which is what links those pages to each other. */
export default function SiteFooter({ excludeVertical }: { excludeVertical?: string } = {}) {
  return (
    <footer className="border-t border-gray-100 pt-14 bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 pb-12">
        <div>
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg tracking-tight no-underline mb-3">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#10b981" />
              <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
            </svg>
            RestKit
          </Link>
          <p className="text-sm text-gray-400 leading-relaxed max-w-[240px]">
            El sistema operativo para restaurantes mexicanos modernos.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Plataforma</h4>
          {["POS & Pagos", "KDS Cocina", "Inventario", "Analíticas", "Facturación CFDI", "Fidelización"].map((l) => (
            <a key={l} href="#modulos" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Empresa</h4>
          {["Nosotros", "Blog", "Soporte", "API Docs", "Contacto"].map((l) => (
            <a key={l} href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Legal</h4>
          {["Privacidad", "Términos de uso", "Cookies", "CFDI & SAT"].map((l) => (
            <a key={l} href="#" className="text-sm text-gray-500 hover:text-emerald-500 transition-colors no-underline">{l}</a>
          ))}
        </div>
      </div>
      <VerticalLinks exclude={excludeVertical} />

      <div className="max-w-[1200px] mx-auto px-6 border-t border-gray-200 py-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">© 2026 RestKit. Todos los derechos reservados.</p>
        <p className="inline-flex items-center gap-1 text-xs text-gray-400">
          Hecho con <Heart size={11} className="text-rose-400 fill-rose-400" /> en México
        </p>
      </div>
    </footer>
  );
}
