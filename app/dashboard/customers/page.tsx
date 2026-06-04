import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { customerService } from "@/services/customer.service";
import Link from "next/link";
import { Users, UserPlus, ChevronRight } from "lucide-react";

export default async function CustomersPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.businessId) {
    return <div>No se encontró configuración de negocio para este usuario.</div>;
  }

  const customers = await customerService.getAllCustomers(session.user.businessId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {customers.length} cliente{customers.length !== 1 ? "s" : ""} registrado{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/dashboard/customers/new"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition-colors"
        >
          <UserPlus size={16} />
          Nuevo Cliente
        </Link>
      </div>

      {/* Customer list */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
              <Users size={28} />
            </div>
            <p className="text-base font-semibold text-gray-900">Sin clientes aún</p>
            <p className="text-sm text-gray-500 mt-1">Agrega tu primer cliente para empezar.</p>
            <Link
              href="/dashboard/customers/new"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              <UserPlus size={16} />
              Nuevo Cliente
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {customers.map((customer) => {
              const id = (customer._id as unknown as string).toString();
              const visitPct = customer.stats.currentVisits > 0
                ? Math.min(customer.stats.currentVisits / 10 * 100, 100)
                : 0;

              return (
                <li key={id}>
                  <Link
                    href={`/dashboard/customers/${id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {customer.email || customer.phone || "Sin contacto"}
                      </p>
                    </div>

                    {/* Visits progress */}
                    <div className="hidden sm:flex flex-col items-end gap-1 w-32 shrink-0">
                      <span className="text-xs text-gray-500 font-medium">
                        {customer.stats.currentVisits} visitas
                      </span>
                      <div className="w-full h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${visitPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Points */}
                    <div className="hidden md:block text-right shrink-0 w-20">
                      <p className="text-sm font-bold text-gray-900">{customer.stats.totalVisits}</p>
                      <p className="text-xs text-gray-400">total</p>
                    </div>

                    <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
