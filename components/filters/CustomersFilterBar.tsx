"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Link from "next/link";

export default function CustomersFilterBar({
  search,
  rewardFilter,
}: {
  search: string;
  rewardFilter: string;
}) {
  const router = useRouter();

  function filterUrl(params: Record<string, string>) {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.reward && params.reward !== "all") sp.set("reward", params.reward);
    return `/dashboard/customers?${sp.toString()}`;
  }

  function handleSearch(value: string) {
    router.push(filterUrl({ search: value, reward: rewardFilter }));
  }

  function handleReward(value: string) {
    router.push(filterUrl({ search, reward: value }));
  }

  const activeFilters = [
    ...(search ? [{ label: `"${search}"`, param: "search" }] : []),
    ...(rewardFilter !== "all" ? [{ label: rewardFilter === "no-reward" ? "Sin premio" : "Con premio", param: "reward" }] : []),
  ];

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar por nombre, email o teléfono…"
        defaultValue={search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={rewardFilter}
          onChange={(e) => handleReward(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Todos los clientes</option>
          <option value="no-reward">Sin progreso en premio</option>
          <option value="at-reward">Con progreso en premio</option>
        </select>

        {activeFilters.length > 0 && (
          <div className="flex gap-2 ml-auto">
            {activeFilters.map((filter) => (
              <Link
                key={filter.param}
                href={filterUrl(
                  activeFilters.reduce(
                    (acc, f) => ({ ...acc, [f.param]: f.param === filter.param ? "" : f.label }),
                    { search, reward: rewardFilter }
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
