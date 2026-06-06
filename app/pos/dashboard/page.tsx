"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Clock, Users } from "lucide-react";
import POSSessionStart from "@/components/pos/POSSessionStart";
import Link from "next/link";

interface EmployeeSession {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  businessId: string;
  role: string;
}

interface Table {
  _id: string;
  number: number;
  name: string;
  capacity: number;
  section: string;
  activeOrder?: any;
}

export default function POSDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [posSession, setPOSSession] = useState<any>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check POS employee session
    const stored = window.localStorage.getItem("posEmployeeSession");
    if (!stored) {
      router.push("/pos");
      return;
    }

    const employeeSession = JSON.parse(stored) as EmployeeSession;

    // Fetch tables and POS session
    fetchData(employeeSession);
  }, [router]);

  async function fetchData(employeeSession: EmployeeSession) {
    try {
      // Fetch available tables
      setSession(employeeSession);

      const tablesRes = await fetch("/api/waiter/available-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: employeeSession.businessId }),
      });

      if (tablesRes.ok) {
        const tablesData = await tablesRes.json();
        setTables(tablesData);
      }

      // Fetch POS session
      // const sessionRes = await fetch("/api/pos-session/current");
       const sessionRes = await fetch(`/api/pos-session/current?employeeNumber=${encodeURIComponent(employeeSession.employeeId)}`);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setPOSSession(sessionData.session);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("posEmployeeSession");
    router.push("/pos");
  }

  function handleSessionStarted() {
    // Refresh POS session
    const stored = window.localStorage.getItem("posEmployeeSession");
    if (stored) {
      const employeeSession = JSON.parse(stored) as EmployeeSession;
      fetchData(employeeSession);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Show session start if no POS session
  if (!posSession && (session.role === "OWNER" || session.role === "ADMIN")) {
    return (
      <div className="min-h-screen bg-gray-50">
        <POSSessionStart
          employeeNumber={session.employeeNumber}
          employeeName={session.employeeName}
          onSessionStarted={handleSessionStarted}
        />
        {/* Logout button */}
        <div className="fixed top-4 right-4">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </div>
    );
  }

  // Show message if no session and user is staff
  if (!posSession && session.role === "STAFF") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Clock size={48} className="mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Caja cerrada</h1>
          <p className="text-gray-600 mb-6">Un gerente debe abrir la caja para comenzar a vender.</p>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </div>
    );
  }

  // Show POS grid if session is open
  const occupied = tables.filter((t) => t.activeOrder).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              👤 {session.employeeName} #{session.employeeNumber}
            </p>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-1">POS — Mesas</h1>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </div>

      {/* Session stats */}
      {posSession && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Dinero inicial</p>
              <p className="text-xl font-extrabold text-gray-900">${posSession.openingBalance.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Dinero (efectivo)</p>
              <p className="text-xl font-extrabold text-emerald-600">${posSession.cashSales.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Total ventas</p>
              <p className="text-xl font-extrabold text-blue-600">${posSession.totalSales.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Órdenes</p>
              <p className="text-xl font-extrabold text-gray-900">{posSession.totalOrders}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tables grid */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            {occupied} de {tables.length} mesas ocupadas
          </p>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <Users size={28} className="mx-auto mb-4 text-gray-300" />
            <p className="text-base font-semibold text-gray-900">Sin mesas configuradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tables.map((table) => {
              const order = table.activeOrder;
              const isOccupied = !!order;

              return (
                <Link
                  key={table._id}
                  href={`/pos/order/${table._id}`}
                  className={`rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all no-underline active:scale-95 ${
                    isOccupied
                      ? "border-amber-300 bg-amber-50 hover:shadow-md"
                      : "border-emerald-300 bg-emerald-50 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mesa</p>
                      <p className="text-3xl font-extrabold text-gray-900 mt-1">{table.number}</p>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isOccupied ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-600">
                      {isOccupied ? "Tomando orden" : "Disponible"}
                    </p>
                    <p className="text-xs text-gray-500">{table.capacity} personas</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
