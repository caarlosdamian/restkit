"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Users, Clock, TrendingUp } from "lucide-react";
import POSSessionStart from "@/components/pos/POSSessionStart";
import POSSessionClose from "@/components/pos/POSSessionClose";

interface WaiterSession {
  waiterId: string;
  waiterName: string;
  employeeNumber: string;
  businessId: string;
  userRole?: string;
}

interface Table {
  id: string;
  number: number;
  name: string;
  capacity: number;
  section: string;
  position?: { x: number; y: number };
  hasOrder: boolean;
  orderStatus?: string;
  orderTotal?: number;
  orderItems: number;
  orderTime?: string;
}

interface POSSessionData {
  id: string;
  staffName: string;
  openingBalance: number;
  startedAt: string;
  totalSales: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: "Abierta", color: "text-amber-700", bg: "bg-amber-50" },
  IN_KITCHEN: { label: "En cocina", color: "text-blue-700", bg: "bg-blue-50" },
  READY: { label: "Lista", color: "text-emerald-700", bg: "bg-emerald-50" },
};

function minutesAgo(date: string | undefined) {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 60_000);
}

export default function WaiterLobbyPage() {
  const router = useRouter();
  const [session, setSession] = useState<WaiterSession | null>(null);
  const [posSession, setPOSSession] = useState<POSSessionData | null>(null);
  const [posSessionLoaded, setPOSSessionLoaded] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    const sessionStr = window.localStorage.getItem("waiterSession");
    if (!sessionStr) {
      router.push("/dashboard/pos/waiter-login");
      return;
    }

    const parsed = JSON.parse(sessionStr) as WaiterSession;
    setSession(parsed);
    fetchPOSSession();
    fetchTables(parsed.businessId);
  }, [router]);

  async function fetchPOSSession() {
    try {
      const res = await fetch("/api/pos-session/current");
      if (res.ok) {
        const data = await res.json();
        setPOSSession(data.session);
      }
    } finally {
      setPOSSessionLoaded(true);
    }
  }

  async function fetchTables(businessId: string) {
    try {
      const res = await fetch("/api/waiter/available-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("waiterSession");
    router.push("/dashboard/pos/waiter-login");
  }

  function handleTableSelect(tableId: string) {
    setSelectedTable(tableId);
    const s = session as WaiterSession;
    localStorage.setItem(
      "waiterContext",
      JSON.stringify({ waiterId: s.waiterId, tableId })
    );
    router.push(`/dashboard/pos/${tableId}?waiter=${s.waiterId}`);
  }

  function handleSessionStarted(sessionId: string) {
    setPOSSession({
      id: sessionId,
      staffName: session?.waiterName || "",
      openingBalance: 0,
      startedAt: new Date().toISOString(),
      totalSales: 0,
      totalOrders: 0,
      cashSales: 0,
      cardSales: 0,
      transferSales: 0,
    });
  }

  function handleSessionClosed() {
    setPOSSession(null);
    router.push("/dashboard");
  }

  if (!session) return null;
  if (!posSessionLoaded) return <div className="p-6 text-center">Cargando...</div>;

  // Show session start screen if no session is open
  if (!posSession && (session.userRole === "OWNER" || session.userRole === "ADMIN")) {
    return (
      <POSSessionStart
        employeeNumber={session.employeeNumber}
        employeeName={session.waiterName}
        onSessionStarted={handleSessionStarted}
      />
    );
  }

  // Show message if waiter but no session
  if (!posSession) {
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
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Show close modal if requested
  if (showCloseModal) {
    return <POSSessionClose session={posSession} onSessionClosed={handleSessionClosed} />;
  }

  // Group tables by section
  const sections = Array.from(new Set(tables.map((t) => t.section)));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Empleado #{session.employeeNumber}</p>
            <h1 className="text-2xl font-extrabold text-gray-900">{session.waiterName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {tables.filter((t) => !t.hasOrder).length} mesas libres
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(session.userRole === "OWNER" || session.userRole === "ADMIN") && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                <TrendingUp size={16} />
                Cerrar caja
              </button>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Dinero inicial</p>
            <p className="text-xl font-extrabold text-gray-900">${posSession.openingBalance.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Dinero (efectivo)</p>
            <p className="text-xl font-extrabold text-emerald-600">${posSession.cashSales.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Total ventas</p>
            <p className="text-xl font-extrabold text-blue-600">${posSession.totalSales.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Órdenes</p>
            <p className="text-xl font-extrabold text-gray-900">{posSession.totalOrders}</p>
          </div>
        </div>

        {/* Tables by section */}
        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <Users size={28} className="mx-auto mb-4 text-gray-300" />
            <p className="text-base font-semibold text-gray-900">No hay mesas disponibles</p>
          </div>
        ) : (
          sections.map((section) => {
            const sectionTables = tables.filter((t) => t.section === section);
            const free = sectionTables.filter((t) => !t.hasOrder).length;

            return (
              <div key={section} className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <p className="text-sm font-bold uppercase tracking-wider text-gray-600">{section}</p>
                  <span className="text-xs font-semibold text-gray-500">
                    {free} libres / {sectionTables.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {sectionTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table.id)}
                      disabled={selectedTable === table.id}
                      className={`rounded-xl border-2 p-4 text-left transition-all active:scale-95 ${
                        table.hasOrder
                          ? `border-amber-300 bg-amber-50 cursor-not-allowed opacity-60`
                          : `border-emerald-300 bg-emerald-50 hover:border-emerald-400 hover:shadow-md cursor-pointer`
                      }`}
                    >
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Mesa</p>
                          <p className="text-2xl font-extrabold text-gray-900">{table.number}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">{table.capacity} personas</p>

                          {table.hasOrder ? (
                            <div className="space-y-1">
                              <div
                                className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${
                                  STATUS_CONFIG[table.orderStatus || ""]?.bg
                                } ${STATUS_CONFIG[table.orderStatus || ""]?.color}`}
                              >
                                {STATUS_CONFIG[table.orderStatus || ""]?.label}
                              </div>
                              <p className="text-[0.65rem] text-gray-500">
                                {table.orderItems} items · {minutesAgo(table.orderTime)} min
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Disponible
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Info */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">💡 Cómo funciona:</p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
            <li>Selecciona una mesa disponible (verde)</li>
            <li>Agrega los pedidos de los clientes</li>
            <li>Envía el pedido a cocina</li>
            <li>Cuando termines, vuelve al lobby</li>
            <li>Otra mesera puede continuar con esa mesa</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
