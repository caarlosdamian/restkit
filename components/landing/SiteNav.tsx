import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shared by the home page and every vertical landing page, so the header
 *  never drifts between them. */
export default function SiteNav({ isAuthenticated, panelHref }: { isAuthenticated: boolean; panelHref: string }) {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg tracking-tight no-underline whitespace-nowrap shrink-0">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#10b981" />
            <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
          </svg>
          RestKit
        </Link>
        <nav className="hidden md:flex gap-7 flex-1">
          <a href="#modulos" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Módulos</a>
          <a href="#analytics" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Analíticas</a>
          <a href="#fidelizacion" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Fidelización</a>
          <a href="#precios" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors no-underline">Precios</a>
        </nav>
        <div className="flex gap-3 items-center shrink-0">
          {isAuthenticated ? (
            <Link
              href={panelHref}
              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm no-underline"
            >
              Ir al panel <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-gray-500 hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-50 transition-all no-underline">
                Iniciar sesión
              </Link>
              <Link href="/registro" className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm no-underline">
                Prueba gratis
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
