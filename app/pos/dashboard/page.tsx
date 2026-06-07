"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Clock, Users } from "lucide-react";
import POSSessionStart from "@/components/pos/POSSessionStart";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// Display-only snapshot cached after the terminal logs in. Never used for
// authorization — the server derives identity from the session cookie.
interface EmployeeSession {
  employeeName: string;
  role: string;
  businessId?: string;
  employeeNumber?: string;
}

interface ActiveOrder {
  _id: string;
  status: string;
  total: number;
  itemCount: number;
}

interface Table {
  _id: string;
  number: number;
  name: string;
  capacity: number;
  section: string;
  isOccupied?: boolean;
  activeOrder?: ActiveOrder | null;
}

type TableFilter = "all" | "busy" | "free";

// A table is busy if it has an active order OR was manually marked occupied.
function isBusy(t: Table): boolean {
  return !!t.activeOrder || !!t.isOccupied;
}

export default function POSDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [posSession, setPOSSession] = useState<any>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TableFilter>("all");

  // Mark/free a table manually (only meaningful when it has no active order).
  async function toggleBusy(table: Table) {
    const next = !table.isOccupied;
    setTables((prev) =>
      prev.map((t) => (t._id === table._id ? { ...t, isOccupied: next } : t))
    );
    try {
      const res = await fetch(`/api/pos/tables/${table._id}/occupancy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOccupied: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setTables((prev) =>
        prev.map((t) => (t._id === table._id ? { ...t, isOccupied: !next } : t))
      );
    }
  }

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
      });

      if (tablesRes.ok) {
        const tablesData = await tablesRes.json() as {success:boolean,tables:[]};
        setTables(tablesData.tables);
      }

      // Fetch POS session
      const sessionRes = await fetch("/api/pos-session/current");
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setPOSSession(sessionData.session);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    localStorage.removeItem("posEmployeeSession");
    await authClient.signOut();
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
  const occupied = tables.filter(isBusy).length;
  const visibleTables = tables.filter((t) =>
    filter === "all" ? true : filter === "busy" ? isBusy(t) : !isBusy(t)
  );

  const FILTERS: Array<{ key: TableFilter; label: string }> = [
    { key: "all", label: `Todas (${tables.length})` },
    { key: "busy", label: `Ocupadas (${occupied})` },
    { key: "free", label: `Libres (${tables.length - occupied})` },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              👤 {session.employeeName}
              {session.employeeNumber ? ` #${session.employeeNumber}` : ""}
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm text-gray-600">
            {occupied} de {tables.length} mesas ocupadas
          </p>
          {/* Filter chips */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <Users size={28} className="mx-auto mb-4 text-gray-300" />
            <p className="text-base font-semibold text-gray-900">Sin mesas configuradas</p>
          </div>
        ) : visibleTables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <p className="text-base font-semibold text-gray-900">
              {filter === "busy" ? "No hay mesas ocupadas" : "No hay mesas libres"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visibleTables.map((table) => {
              const order = table.activeOrder;
              const hasOrder = !!order;
              const busy = hasOrder || !!table.isOccupied;

              // Visual state: order = amber, manual busy = rose, free = emerald
              const tone = hasOrder
                ? { border: "border-amber-300", bg: "bg-amber-50", dot: "bg-amber-400" }
                : table.isOccupied
                ? { border: "border-rose-300", bg: "bg-rose-50", dot: "bg-rose-400" }
                : { border: "border-emerald-300", bg: "bg-emerald-50", dot: "bg-emerald-400" };

              return (
                <div
                  key={table._id}
                  className={`relative rounded-2xl border-2 p-5 transition-all ${tone.border} ${tone.bg}`}
                >
                  {/* Manual occupancy toggle — hidden while an order is active
                      (the order itself keeps the table busy). */}
                  {!hasOrder && (
                    <button
                      onClick={() => toggleBusy(table)}
                      className={`absolute top-2.5 right-2.5 z-10 text-[0.65rem] font-bold px-2 py-1 rounded-full border transition-colors ${
                        table.isOccupied
                          ? "bg-white border-rose-200 text-rose-600 hover:bg-rose-100"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {table.isOccupied ? "Liberar" : "Ocupar"}
                    </button>
                  )}

                  <Link
                    href={`/pos/order/${table._id}`}
                    className="block no-underline active:scale-95 transition-transform"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mesa</p>
                        <p className="text-3xl font-extrabold text-gray-900 mt-1">{table.number}</p>
                      </div>
                      <div className={`w-3 h-3 rounded-full mt-1 ${tone.dot}`} />
                    </div>
                    <div className="space-y-1 mt-3">
                      <p className="text-xs font-semibold text-gray-600">
                        {hasOrder ? "Tomando orden" : table.isOccupied ? "Ocupada" : "Disponible"}
                      </p>
                      {hasOrder ? (
                        <p className="text-xs text-gray-500">
                          {order!.itemCount} producto{order!.itemCount !== 1 ? "s" : ""} · ${order!.total.toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">{table.capacity} personas</p>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
