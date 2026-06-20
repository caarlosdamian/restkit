import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Product from "@/models/Product";
import InventoryItem from "@/models/InventoryItem";
import dbConnect from "@/lib/db";
import ProductForm from "@/components/menu/ProductForm";
import EditProductButton from "@/components/menu/EditProductButton";
import DeleteProductButton from "@/components/menu/DeleteProductButton";
import ToggleAvailableButton from "@/components/menu/ToggleAvailableButton";
import MenuFilterBar from "@/components/filters/MenuFilterBar";
import { Package } from "lucide-react";

type AvailabilityFilter = "all" | "available" | "unavailable";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; availability?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role === "STAFF") redirect("/pos");

  const sp = await searchParams;
  const search = (sp.search || "").toLowerCase();
  const categoryFilter = sp.category || "all";
  const availabilityFilter = (sp.availability || "all") as AvailabilityFilter;

  await dbConnect();
  let products = await Product.find({
    businessId: session.user.businessId,
  }).sort({ category: 1, sortOrder: 1, name: 1 });

  // Apply filters
  if (search) {
    products = products.filter((p) =>
      p.name.toLowerCase().includes(search) || p.description?.toLowerCase().includes(search)
    );
  }

  if (categoryFilter !== "all") {
    products = products.filter((p) => (p.category || "General") === categoryFilter);
  }

  if (availabilityFilter === "available") {
    products = products.filter((p) => p.isAvailable);
  } else if (availabilityFilter === "unavailable") {
    products = products.filter((p) => !p.isAvailable);
  }

  const inventoryItems = (
    await InventoryItem.find({ businessId: session.user.businessId, isActive: true }).sort({ name: 1 })
  ).map((i) => ({ id: i._id.toString(), name: i.name, unit: i.unit }));

  const allCategories = Array.from(
    new Set(
      await Product.find({ businessId: session.user.businessId })
        .distinct("category")
        .then((cats) => cats.map((c) => c || "General"))
    )
  ).sort();

  const byCategory = products.reduce<Record<string, typeof products>>((acc, p) => {
    const cat = p.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Menú</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {products.length} producto{products.length !== 1 ? "s" : ""} en {Object.keys(byCategory).length} categoría{Object.keys(byCategory).length !== 1 ? "s" : ""}
          </p>
        </div>
        <ProductForm inventoryItems={inventoryItems} />
      </div>

      {/* Filters */}
      <MenuFilterBar
        search={search}
        categoryFilter={categoryFilter}
        availabilityFilter={availabilityFilter}
        allCategories={allCategories}
      />

      {/* Empty state */}
      {products.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mx-auto mb-4">
            <Package size={28} />
          </div>
          <p className="text-base font-semibold text-gray-900">Sin productos con estos filtros</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">Ajusta los filtros o agrega nuevos productos.</p>
          <ProductForm inventoryItems={inventoryItems} />
        </div>
      )}

      {/* Products by category */}
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{category} ({items.length})</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {items.map((product) => (
              <li key={product._id.toString()} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                    {!product.isAvailable && (
                      <span className="text-[0.65rem] font-bold bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full">
                        No disponible
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{product.description}</p>
                  )}
                </div>
                <p className="text-sm font-extrabold text-gray-900 shrink-0">
                  ${product.price.toFixed(2)}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <ToggleAvailableButton
                    productId={product._id.toString()}
                    isAvailable={product.isAvailable}
                  />
                  <EditProductButton
                    product={{
                      id: product._id.toString(),
                      name: product.name,
                      description: product.description,
                      price: product.price,
                      category: product.category,
                      isAvailable: product.isAvailable,
                      recipe: product.recipe?.map((r) => ({
                        inventoryItemId: r.inventoryItemId.toString(),
                        quantity: r.quantity,
                      })),
                    }}
                    inventoryItems={inventoryItems}
                  />
                  <DeleteProductButton productId={product._id.toString()} name={product.name} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
