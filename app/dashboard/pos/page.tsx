import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Table from "@/models/Table";
import Order from "@/models/Order";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import Link from "next/link";
import { Users, LayoutGrid } from "lucide-react";
import AddTableButton from "@/components/pos/AddTableButton";
import TablesFilterBar from "@/components/filters/TablesFilterBar";

type OrderStatus = "OPEN" | "IN_KITCHEN" | "READY";
type StatusFilter = "all" | "available" | "occupied";

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; card: string }
> = {
  available: {
    label: "Disponible",
    dot: "bg-gray-300",
    card: "border-gray-200 bg-white hover:border-emerald-400 hover:shadow-md",
  },
  OPEN: {
    label: "Tomando orden",
    dot: "bg-amber-400",
    card: "border-amber-300 bg-amber-50 hover:shadow-md",
  },
  IN_KITCHEN: {
    label: "En cocina",
    dot: "bg-blue-400 animate-pulse",
    card: "border-blue-300 bg-blue-50 hover:shadow-md",
  },
  READY: {
    label: "Lista para cobrar",
    dot: "bg-emerald-400",
    card: "border-emerald-400 bg-emerald-50 hover:shadow-md",
  },
};

function minutesAgo(date: Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 60_000);
}

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sp = await searchParams;
  const search = (sp.search || "").toLowerCase();
  const statusFilter = (sp.status || "all") as StatusFilter;

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);
  const canManage = ["OWNER", "ADMIN"].includes(session.user.role);

  let tables = await Table.aggregate([
    { $match: { businessId: bId, isActive: true } },
    { $sort: { number: 1 } },
    {
      $lookup: {
        from: "orders",
        let: { tableId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$tableId", "$$tableId"] },
              status: { $in: ["OPEN", "IN_KITCHEN", "READY"] },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ],
        as: "activeOrder",
      },
    },
    { $addFields: { activeOrder: { $arrayElemAt: ["$activeOrder", 0] } } },
  ]);

  // Apply filters
  if (search) {
    tables = tables.filter((t) =>
      (t.name || `Mesa ${t.number}`).toLowerCase().includes(search) ||
      t.number.toString().includes(search)
    );
  }

  if (statusFilter === "available") {
    tables = tables.filter((t) => !t.activeOrder);
  } else if (statusFilter === "occupied") {
    tables = tables.filter((t) => t.activeOrder);
  }

  const occupied = tables.filter((t) => t.activeOrder).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            POS — Mesas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {occupied} de {tables.length} mesas ocupadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link
              href="/dashboard/pos/layout"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LayoutGrid size={16} />
              Distribuir Mesas
            </Link>
          )}
          {canManage && <AddTableButton />}
        </div>
      </div>

      {/* Filters */}
      <TablesFilterBar search={search} statusFilter={statusFilter} />

      {/* No tables yet */}
      {tables.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mx-auto mb-4">
            <Users size={28} />
          </div>
          <p className="text-base font-semibold text-gray-900">Sin mesas configuradas</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            Agrega las mesas de tu restaurante para empezar a tomar órdenes.
          </p>
          {canManage && <AddTableButton />}
        </div>
      )}

      {/* Check if any tables have position data */}
      {tables.length > 0 && tables.some((t) => t.position) ? (
        // Layout view (if positions are set)
        <div className="space-y-6">
          {/* Group by section */}
          {Array.from(new Set(tables.map((t) => t.section || "Sin sección"))).map((section) => {
            const sectionTables = tables.filter((t) => (t.section || "Sin sección") === section);
            const hasPositions = sectionTables.some((t) => t.position);

            return (
              <div key={section}>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">{section}</p>
                {hasPositions ? (
                  // Canvas layout
                  <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ position: "relative", height: "400px" }}>
                    <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: "#f9fafb" }}>
                      {sectionTables.map((table) => {
                        const order = table.activeOrder;
                        const statusKey = order ? (order.status as OrderStatus) : "available";
                        const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.available;
                        const x = table.position?.x ?? 0;
                        const y = table.position?.y ?? 0;
                        const canvasWidth = 1200;
                        const canvasHeight = 400;

                        return (
                          <Link
                            key={table._id.toString()}
                            href={`/dashboard/pos/${table._id}`}
                            className={`rounded-xl border-2 p-3 flex flex-col gap-2 transition-all absolute no-underline active:scale-95 ${cfg.card}`}
                            style={{
                              left: `${(x / canvasWidth) * 100}%`,
                              top: `${(y / canvasHeight) * 100}%`,
                              width: "80px",
                              height: "80px",
                            }}
                          >
                            <div className="flex items-start justify-between flex-1">
                              <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Mesa</p>
                                <p className="text-xl font-extrabold text-gray-900">{table.number}</p>
                              </div>
                              <div className={`w-2 h-2 rounded-full mt-1 ${cfg.dot}`} />
                            </div>
                            <p className="text-[0.65rem] text-gray-500">{table.capacity} pers.</p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Grid layout for sections without positions
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {sectionTables.map((table) => {
                      const order = table.activeOrder;
                      const statusKey = order ? (order.status as OrderStatus) : "available";
                      const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.available;

                      return (
                        <Link
                          key={table._id.toString()}
                          href={`/dashboard/pos/${table._id}`}
                          className={`rounded-xl border-2 p-4 flex flex-col gap-2 transition-all no-underline active:scale-95 ${cfg.card}`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase">Mesa</p>
                              <p className="text-2xl font-extrabold text-gray-900">{table.number}</p>
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full mt-1 ${cfg.dot}`} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-600">{cfg.label}</p>
                            <p className="text-[0.65rem] text-gray-500">{table.capacity} personas</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Default grid view
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map((table) => {
            const order = table.activeOrder;
            const statusKey = order ? (order.status as OrderStatus) : "available";
            const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.available;

            return (
              <Link
                key={table._id.toString()}
                href={`/dashboard/pos/${table._id}`}
                className={`rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all no-underline active:scale-95 ${cfg.card}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Mesa
                    </p>
                    <p className="text-3xl font-extrabold tracking-tight text-gray-900 leading-none mt-0.5">
                      {table.number}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full mt-1 ${cfg.dot}`} />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-600">{cfg.label}</p>
                  {order ? (
                    <>
                      <p className="text-sm font-extrabold text-gray-900">
                        ${order.total.toFixed(2)}
                      </p>
                      <p className="text-[0.65rem] text-gray-400">
                        {order.items.length} producto{order.items.length !== 1 ? "s" : ""} ·{" "}
                        {minutesAgo(order.createdAt)} min
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Users size={12} />
                      <span>{table.capacity} personas</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {tables.length > 0 && (
        <div className="flex flex-wrap gap-4 pt-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-xs text-gray-500">
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot.split(" ")[0]}`} />
              {cfg.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
