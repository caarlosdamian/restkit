"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Users } from "lucide-react";

interface StaffSession {
  staffId: string;
  staffName: string;
}

interface Table {
  _id: string;
  number: number;
  name?: string;
  capacity: number;
  activeOrder?: {
    total: number;
    items: Array<{ name: string; quantity: number }>;
    createdAt: Date;
  };
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; card: string }> = {
  available: {
    label: "Disponible",
    dot: "bg-gray-300",
    card: "border-gray-200 bg-white hover:border-emerald-400 hover:shadow-md",
  },
  occupied: {
    label: "Ocupada",
    dot: "bg-amber-400",
    card: "border-amber-300 bg-amber-50 hover:shadow-md",
  },
};

function minutesAgo(date: Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 60_000);
}

export default function StaffPosPage() {
  const router = useRouter();
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get staff session from localStorage
    const session = localStorage.getItem("staffSession");
    if (!session) {
      router.push("/dashboard/pos/staff-login");
      return;
    }

    const parsed = JSON.parse(session) as StaffSession;
    setStaffSession(parsed);

    // Fetch assigned tables
    fetchTables(parsed.staffId);
  }, [router]);

  async function fetchTables(staffId: string) {
    try {
      const res = await fetch(`/api/staff/${staffId}/tables`);
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("staffSession");
    router.push("/dashboard/pos/staff-login");
  }

  if (!staffSession) return null;
  if (loading) return <div className="p-6 text-center">Cargando mesas...</div>;

  const occupied = tables.filter((t) => t.activeOrder).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Bienvenido</p>
            <h1 className="text-2xl font-extrabold text-gray-900">{staffSession.staffName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {occupied} de {tables.length} mesas ocupadas
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>

        {/* Tables */}
        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mx-auto mb-4">
              <Users size={28} />
            </div>
            <p className="text-base font-semibold text-gray-900">Sin mesas asignadas</p>
            <p className="text-sm text-gray-400 mt-1">El gerente aún no te ha asignado ninguna mesa.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((table) => {
              const statusKey = table.activeOrder ? "occupied" : "available";
              const cfg = STATUS_CONFIG[statusKey];

              return (
                <Link
                  key={table._id}
                  href={`/dashboard/pos/${table._id}`}
                  className={`rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all no-underline active:scale-95 ${cfg.card}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mesa</p>
                      <p className="text-3xl font-extrabold tracking-tight text-gray-900 leading-none mt-0.5">
                        {table.number}
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full mt-1 ${cfg.dot}`} />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-600">{cfg.label}</p>
                    {table.activeOrder ? (
                      <>
                        <p className="text-sm font-extrabold text-gray-900">
                          ${table.activeOrder.total.toFixed(2)}
                        </p>
                        <p className="text-[0.65rem] text-gray-400">
                          {table.activeOrder.items.length} producto{table.activeOrder.items.length !== 1 ? "s" : ""} · {" "}
                          {minutesAgo(new Date(table.activeOrder.createdAt))} min
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">{table.capacity} personas</p>
                    )}
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
