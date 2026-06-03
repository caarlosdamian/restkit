import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { Home, Users, QrCode, ClipboardList, Settings } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-xl tracking-tight no-underline">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#10b981" />
              <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
            </svg>
            RestKit
          </Link>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Panel de Control</p>
        </div>
        <nav className="flex-1 py-6 px-4 flex flex-col gap-1.5">
          <Link
            href="/dashboard"
            className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
          >
            <Home size={18} className="mr-3" />
            Inicio
          </Link>
          <Link
            href="/dashboard/customers"
            className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
          >
            <Users size={18} className="mr-3" />
            Clientes
          </Link>
          <Link
            href="/dashboard/scan"
            className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
          >
            <QrCode size={18} className="mr-3" />
            Escanear QR
          </Link>
          <Link
            href="/dashboard/visits"
            className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
          >
            <ClipboardList size={18} className="mr-3" />
            Visitas
          </Link>
          <div className="my-3 border-t border-gray-200 mx-2"></div>
          <Link
            href="/dashboard/settings"
            className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
          >
            <Settings size={18} className="mr-3" />
            Configuración
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="flex items-center justify-between bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
            Bienvenido, {session.user.name}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full">
              {session.user.role}
            </span>
            <LogoutButton />
          </div>
        </header>
        <div className="p-8 flex-1">
          <div className="max-w-[1200px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
