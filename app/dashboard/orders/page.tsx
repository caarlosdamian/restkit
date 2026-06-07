import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Order from "@/models/Order";
import { businessRepository } from "@/repositories/business.repository";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import Link from "next/link";
import ReprintButton from "@/components/pos/ReprintButton";

type Period = "today" | "week" | "month";
type StatusFilter = "all" | "PAID" | "CANCELLED" | "active";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN:       { label: "Abierta",    className: "bg-amber-50 text-amber-700 border-amber-200" },
  IN_KITCHEN: { label: "En cocina",  className: "bg-blue-50 text-blue-700 border-blue-200" },
  READY:      { label: "Lista",      className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PAID:       { label: "Pagada",     className: "bg-gray-100 text-gray-600 border-gray-200" },
  CANCELLED:  { label: "Cancelada",  className: "bg-red-50 text-red-600 border-red-100" },
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", OTHER: "Otro",
};

function periodStart(period: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - 6);
  if (period === "month") d.setDate(d.getDate() - 29);
  return d;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sp = await searchParams;
  const period = (sp.period as Period) || "today";
  const statusFilter = (sp.status as StatusFilter) || "all";

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);
  const since = periodStart(period);

  // Build status filter
  let statusMatch: string[] | undefined;
  if (statusFilter === "PAID") statusMatch = ["PAID"];
  else if (statusFilter === "CANCELLED") statusMatch = ["CANCELLED"];
  else if (statusFilter === "active") statusMatch = ["OPEN", "IN_KITCHEN", "READY"];

  const query: Record<string, unknown> = {
    businessId: bId,
    createdAt: { $gte: since },
  };
  if (statusMatch) query.status = { $in: statusMatch };

  const [orders, business] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).limit(200),
    businessRepository.findById(session.user.businessId),
  ]);

  // Resolve the waiter (order owner) names in a single lookup for trazabilidad.
  const staffIds = [
    ...new Set(orders.map((o) => o.staffId?.toString()).filter(Boolean) as string[]),
  ].map((id) => new mongoose.Types.ObjectId(id));
  const staffUsers = staffIds.length
    ? await mongoose.connection
        .collection("user")
        .find({ _id: { $in: staffIds } }, { projection: { name: 1 } })
        .toArray()
    : [];
  const staffNameById = new Map(staffUsers.map((u) => [u._id.toString(), u.name as string]));

  // Stats (paid orders only)
  const paidOrders = orders.filter((o) => o.status === "PAID");
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);

  const PERIODS: Array<{ key: Period; label: string }> = [
    { key: "today", label: "Hoy" },
    { key: "week", label: "7 días" },
    { key: "month", label: "30 días" },
  ];

  const STATUS_FILTERS = [
    { key: "all",       label: "Todas" },
    { key: "active",    label: "Activas" },
    { key: "PAID",      label: "Pagadas" },
    { key: "CANCELLED", label: "Canceladas" },
  ];

  function filterUrl(p: string, s: string) {
    return `/dashboard/orders?period=${p}&status=${s}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Historial de Órdenes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registro de todas las órdenes del negocio.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Ingresos</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Órdenes pagadas</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900">{paidOrders.length}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Ticket promedio</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900">
            ${paidOrders.length ? (totalRevenue / paidOrders.length).toFixed(2) : "0.00"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {PERIODS.map(({ key, label }) => (
            <Link
              key={key}
              href={filterUrl(key, statusFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors no-underline ${
                period === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {STATUS_FILTERS.map(({ key, label }) => (
            <Link
              key={key}
              href={filterUrl(period, key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors no-underline ${
                statusFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-auto">{orders.length} órdenes</span>
      </div>

      {/* Orders list */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            Sin órdenes en este período.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {orders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.OPEN;
              const date = new Date(order.createdAt);
              const timeStr = date.toLocaleTimeString("es-MX", {
                hour: "2-digit", minute: "2-digit", hour12: false,
              });
              const dateStr = date.toLocaleDateString("es-MX", {
                day: "2-digit", month: "2-digit",
              });
              const summary = order.items
                .slice(0, 2)
                .map((i) => `${i.name} ×${i.quantity}`)
                .join(", ");
              const extra = order.items.length > 2 ? ` +${order.items.length - 2} más` : "";

              return (
                <li key={order._id.toString()} className="flex items-center gap-4 px-6 py-4">
                  {/* Ticket # */}
                  <div className="shrink-0 w-20 hidden sm:block">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket</p>
                    <p className="text-sm font-bold text-gray-700">
                      #{order.ticketNumber ?? order._id.toString().slice(-6).toUpperCase()}
                    </p>
                  </div>

                  {/* Table + items */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{order.tableName}</p>
                      <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full border ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {summary}{extra}
                      {staffNameById.get(order.staffId?.toString()) && (
                        <span className="text-gray-300"> · {staffNameById.get(order.staffId?.toString())}</span>
                      )}
                    </p>
                  </div>

                  {/* Payment method */}
                  {order.paymentMethod && (
                    <span className="hidden md:block text-xs font-semibold text-gray-500 shrink-0">
                      {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                    </span>
                  )}

                  {/* Total */}
                  <p className="text-sm font-extrabold text-gray-900 shrink-0 w-20 text-right">
                    ${order.total.toFixed(2)}
                  </p>

                  {/* Time */}
                  <p className="text-xs text-gray-400 shrink-0 w-16 text-right hidden sm:block">
                    {dateStr} {timeStr}
                  </p>

                  {/* Reprint */}
                  {order.status === "PAID" && business && (
                    <ReprintButton
                      order={{
                        ticketNumber: order.ticketNumber ?? order._id.toString().slice(-6).toUpperCase(),
                        tableName: order.tableName,
                        items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                        total: order.total,
                        paymentMethod: order.paymentMethod ?? "OTHER",
                        amountReceived: order.amountReceived,
                        change: order.change,
                        closedAt: order.closedAt ?? order.createdAt,
                      }}
                      businessName={business.name}
                      ticketConfig={business.ticket}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
