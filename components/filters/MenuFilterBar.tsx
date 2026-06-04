"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MenuFilterBar({
  search,
  categoryFilter,
  availabilityFilter,
  allCategories,
}: {
  search: string;
  categoryFilter: string;
  availabilityFilter: string;
  allCategories: string[];
}) {
  const router = useRouter();

  function filterUrl(params: Record<string, string>) {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.category && params.category !== "all") sp.set("category", params.category);
    if (params.availability && params.availability !== "all") sp.set("availability", params.availability);
    return `/dashboard/menu?${sp.toString()}`;
  }

  function handleSearch(value: string) {
    router.push(filterUrl({ search: value, category: categoryFilter, availability: availabilityFilter }));
  }

  function handleCategory(value: string) {
    router.push(filterUrl({ search, category: value, availability: availabilityFilter }));
  }

  function handleAvailability(value: string) {
    router.push(filterUrl({ search, category: categoryFilter, availability: value }));
  }

  const activeFilters = [
    ...(search ? [{ label: `"${search}"`, param: "search" }] : []),
    ...(categoryFilter !== "all" ? [{ label: categoryFilter, param: "category" }] : []),
    ...(availabilityFilter !== "all" ? [{ label: availabilityFilter, param: "availability" }] : []),
  ];

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar productos…"
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
          value={availabilityFilter}
          onChange={(e) => handleAvailability(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Todos los estados</option>
          <option value="available">Disponibles</option>
          <option value="unavailable">No disponibles</option>
        </select>

        {activeFilters.length > 0 && (
          <div className="flex gap-2 ml-auto">
            {activeFilters.map((filter) => (
              <Link
                key={filter.param}
                href={filterUrl(
                  activeFilters.reduce(
                    (acc, f) => ({ ...acc, [f.param]: f.param === filter.param ? "" : f.label }),
                    { search, category: categoryFilter, availability: availabilityFilter }
                  )
                )}
                className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition-colors no-underline"
              >
                ✕ {filter.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
