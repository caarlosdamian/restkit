"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Link from "next/link";

export default function InventoryFilterBar({
  search,
  categoryFilter,
  stockFilter,
  allCategories,
}: {
  search: string;
  categoryFilter: string;
  stockFilter: string;
  allCategories: string[];
}) {
  const router = useRouter();

  function filterUrl(params: Record<string, string>) {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.category && params.category !== "all") sp.set("category", params.category);
    if (params.stock && params.stock !== "all") sp.set("stock", params.stock);
    return `/dashboard/inventory?${sp.toString()}`;
  }

  function handleSearch(value: string) {
    router.push(filterUrl({ search: value, category: categoryFilter, stock: stockFilter }));
  }

  function handleCategory(value: string) {
    router.push(filterUrl({ search, category: value, stock: stockFilter }));
  }

  function handleStock(value: string) {
    router.push(filterUrl({ search, category: categoryFilter, stock: value }));
  }

  const activeFilters = [
    ...(search ? [{ label: `"${search}"`, param: "search" }] : []),
    ...(categoryFilter !== "all" ? [{ label: categoryFilter, param: "category" }] : []),
    ...(stockFilter !== "all" ? [{ label: stockFilter, param: "stock" }] : []),
  ];

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar artículos…"
        defaultValue={search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => handleCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Todas las categorías</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={stockFilter}
          onChange={(e) => handleStock(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Todos los estados</option>
          <option value="ok">Stock OK</option>
          <option value="low">Stock bajo</option>
          <option value="out">Agotado</option>
        </select>

        {activeFilters.length > 0 && (
          <div className="flex gap-2 ml-auto">
            {activeFilters.map((filter) => (
              <Link
                key={filter.param}
                href={filterUrl(
                  activeFilters.reduce(
                    (acc, f) => ({ ...acc, [f.param]: f.param === filter.param ? "" : f.label }),
                    { search, category: categoryFilter, stock: stockFilter }
                  )
                )}
                className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition-colors no-underline"
              >
                <X size={12} /> {filter.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
