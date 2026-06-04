"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TablesFilterBar({
  search,
  statusFilter,
}: {
  search: string;
  statusFilter: string;
}) {
  const router = useRouter();

  function filterUrl(params: Record<string, string>) {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.status && params.status !== "all") sp.set("status", params.status);
    return `/dashboard/pos?${sp.toString()}`;
  }

  function handleSearch(value: string) {
    router.push(filterUrl({ search: value, status: statusFilter }));
  }

  function handleStatus(value: string) {
    router.push(filterUrl({ search, status: value }));
  }

  const activeFilters = [
    ...(search ? [{ label: `"${search}"`, param: "search" }] : []),
    ...(statusFilter !== "all" ? [{ label: statusFilter === "available" ? "Disponibles" : "Ocupadas", param: "status" }] : []),
  ];

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar mesa por nombre o número…"
        defaultValue={search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => handleStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Todas las mesas</option>
          <option value="available">Disponibles</option>
          <option value="occupied">Ocupadas</option>
        </select>

        {activeFilters.length > 0 && (
          <div className="flex gap-2 ml-auto">
            {activeFilters.map((filter) => (
              <Link
                key={filter.param}
                href={filterUrl(
                  activeFilters.reduce(
                    (acc, f) => ({ ...acc, [f.param]: f.param === filter.param ? "" : f.label }),
                    { search, status: statusFilter }
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
