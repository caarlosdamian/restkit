import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import InventoryItem from "@/models/InventoryItem";
import dbConnect from "@/lib/db";
import InventoryItemForm from "@/components/inventory/InventoryItemForm";
import EditInventoryItemButton from "@/components/inventory/EditInventoryItemButton";
import DeleteInventoryItemButton from "@/components/inventory/DeleteInventoryItemButton";
import StockAdjustButton from "@/components/inventory/StockAdjustButton";
import InventoryFilterBar from "@/components/filters/InventoryFilterBar";
import { Boxes, AlertTriangle, XCircle } from "lucide-react";

type StockFilter = "all" | "ok" | "low" | "out";

function stockStatus(quantity: number, lowStockThreshold: number): StockFilter {
  if (quantity <= 0) return "out";
  if (quantity <= lowStockThreshold) return "low";
  return "ok";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; stock?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role === "STAFF") redirect("/pos");

  const sp = await searchParams;
  const search = (sp.search || "").toLowerCase();
  const categoryFilter = sp.category || "all";
  const stockFilter = (sp.stock || "all") as StockFilter;

  await dbConnect();
  let items = await InventoryItem.find({
    businessId: session.user.businessId,
    isActive: true,
  }).sort({ category: 1, name: 1 });

  // Stats computed before filtering, so the strip reflects the whole inventory.
  const stats = items.reduce(
    (acc, i) => {
      const status = stockStatus(i.quantity, i.lowStockThreshold);
      if (status === "low") acc.low += 1;
      if (status === "out") acc.out += 1;
      return acc;
    },
    { total: items.length, low: 0, out: 0 }
  );

  if (search) {
    items = items.filter((i) => i.name.toLowerCase().includes(search));
  }

  if (categoryFilter !== "all") {
    items = items.filter((i) => (i.category || "General") === categoryFilter);
  }

  if (stockFilter !== "all") {
    items = items.filter((i) => stockStatus(i.quantity, i.lowStockThreshold) === stockFilter);
  }

  const allCategories = Array.from(
    new Set(
      (await InventoryItem.find({ businessId: session.user.businessId, isActive: true }).distinct(
        "category"
      )) as string[]
    )
  ).sort();

  const byCategory = items.reduce<Record<string, typeof items>>((acc, i) => {
    const cat = i.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total} artículo{stats.total !== 1 ? "s" : ""} registrado{stats.total !== 1 ? "s" : ""}
          </p>
        </div>
        <InventoryItemForm />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
            <Boxes size={18} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total de artículos</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">{stats.low}</p>
            <p className="text-xs text-gray-500">Stock bajo</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">{stats.out}</p>
            <p className="text-xs text-gray-500">Agotados</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <InventoryFilterBar
        search={search}
        categoryFilter={categoryFilter}
        stockFilter={stockFilter}
        allCategories={allCategories}
      />

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mx-auto mb-4">
            <Boxes size={28} />
          </div>
          <p className="text-base font-semibold text-gray-900">Sin artículos con estos filtros</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">Ajusta los filtros o agrega nuevos artículos.</p>
          <InventoryItemForm />
        </div>
      )}

      {/* Items by category */}
      {Object.entries(byCategory).map(([category, categoryItems]) => (
        <div key={category} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {category} ({categoryItems.length})
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {categoryItems.map((item) => {
              const status = stockStatus(item.quantity, item.lowStockThreshold);
              return (
                <li key={item._id.toString()} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      {status === "low" && (
                        <span className="text-[0.65rem] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-full">
                          Stock bajo
                        </span>
                      )}
                      {status === "out" && (
                        <span className="text-[0.65rem] font-bold bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full">
                          Agotado
                        </span>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{item.notes}</p>}
                  </div>
                  <p
                    className={`text-sm font-extrabold shrink-0 ${
                      status === "out"
                        ? "text-red-500"
                        : status === "low"
                          ? "text-amber-600"
                          : "text-gray-900"
                    }`}
                  >
                    {item.quantity} {item.unit}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <StockAdjustButton
                      item={{ id: item._id.toString(), name: item.name, unit: item.unit }}
                    />
                    <EditInventoryItemButton
                      item={{
                        id: item._id.toString(),
                        name: item.name,
                        unit: item.unit,
                        lowStockThreshold: item.lowStockThreshold,
                        category: item.category,
                        notes: item.notes,
                      }}
                    />
                    <DeleteInventoryItemButton itemId={item._id.toString()} name={item.name} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
