import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Table from "@/models/Table";
import dbConnect from "@/lib/db";
import TableForm from "@/components/tables/TableForm";
import EditTableButton from "@/components/tables/EditTableButton";
import DeleteTableButton from "@/components/tables/DeleteTableButton";
import { LayoutGrid, Users } from "lucide-react";

export default async function TablesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!["OWNER", "ADMIN"].includes(session.user.role as string)) redirect("/pos");

  await dbConnect();
  const tables = await Table.find({
    businessId: session.user.businessId,
    isActive: true,
  }).sort({ number: 1 });

  const bySection = tables.reduce<Record<string, typeof tables>>((acc, t) => {
    const section = t.section || "Sin sección";
    if (!acc[section]) acc[section] = [];
    acc[section].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Mesas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tables.length} mesa{tables.length !== 1 ? "s" : ""} configurada{tables.length !== 1 ? "s" : ""}
            {" · "}visible{tables.length !== 1 ? "s" : ""} en el POS
          </p>
        </div>
        <TableForm />
      </div>

      {/* Empty state */}
      {tables.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mx-auto mb-4">
            <LayoutGrid size={28} />
          </div>
          <p className="text-base font-semibold text-gray-900">Sin mesas configuradas</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            Agrega al menos una mesa para poder tomar órdenes en el POS.
          </p>
          <TableForm />
        </div>
      )}

      {/* Tables by section */}
      {Object.entries(bySection).map(([section, sectionTables]) => (
        <div key={section} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {section} ({sectionTables.length})
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {sectionTables.map((table) => (
              <li key={table._id.toString()} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                  {table.number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {table.name || `Mesa ${table.number}`}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Users size={11} /> {table.capacity} personas
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <EditTableButton
                    table={{
                      id: table._id.toString(),
                      number: table.number,
                      name: table.name,
                      capacity: table.capacity,
                      section: table.section,
                    }}
                  />
                  <DeleteTableButton
                    tableId={table._id.toString()}
                    name={table.name || `Mesa ${table.number}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
