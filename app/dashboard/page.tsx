import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Users, ScanLine, Gift } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Resumen de tu negocio</h1>
        <p className="text-sm text-gray-500 mt-1">Monitorea el rendimiento de tu programa de fidelización.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Stat Cards */}
        <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Users size={20} />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Clientes</h3>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">0</p>
        </div>
        <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ScanLine size={20} />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visitas Hoy</h3>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">0</p>
        </div>
        <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Gift size={20} />
            </div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recompensas Entregadas</h3>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">0</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group">
            <div className="w-12 h-12 rounded-full bg-gray-50 group-hover:bg-emerald-500/10 flex items-center justify-center text-gray-500 group-hover:text-emerald-500 transition-colors">
              <Users size={24} />
            </div>
            <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-500 transition-colors">Nuevo Cliente</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group">
            <div className="w-12 h-12 rounded-full bg-gray-50 group-hover:bg-emerald-500/10 flex items-center justify-center text-gray-500 group-hover:text-emerald-500 transition-colors">
              <ScanLine size={24} />
            </div>
            <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-500 transition-colors">Escanear QR</span>
          </button>
        </div>
      </div>
    </div>
  );
}
