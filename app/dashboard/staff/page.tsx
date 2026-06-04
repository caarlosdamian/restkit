import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import AddStaffForm from "@/components/dashboard/AddStaffForm";
import RemoveStaffButton from "@/components/dashboard/RemoveStaffButton";
import StaffFilterBar from "@/components/filters/StaffFilterBar";
import { Shield, Users } from "lucide-react";
import Link from "next/link";

const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  OWNER:  { label: "Dueño",   className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  ADMIN:  { label: "Gerente", className: "bg-blue-50 text-blue-700 border-blue-100" },
  STAFF:  { label: "Empleado",className: "bg-gray-100 text-gray-600 border-gray-200" },
};

type RoleFilter = "all" | "ADMIN" | "STAFF";

async function getStaff(businessId: string, ownerId: string) {
  await dbConnect();
  const staff = await mongoose.connection
    .collection("user")
    .find(
      { businessId, _id: { $ne: new mongoose.Types.ObjectId(ownerId) } },
      { projection: { password: 0 } }
    )
    .sort({ createdAt: -1 })
    .toArray();

  return staff.map((s) => ({
    id: s._id.toString(),
    name: s.name as string,
    email: s.email as string,
    role: (s.role as string) ?? "STAFF",
    createdAt: s.createdAt as Date,
  }));
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/dashboard");

  const sp = await searchParams;
  const search = (sp.search || "").toLowerCase();
  const roleFilter = (sp.role || "all") as RoleFilter;

  let staff = await getStaff(session.user.businessId, session.user.id);

  // Apply filters
  if (search) {
    staff = staff.filter((s) =>
      s.name.toLowerCase().includes(search) || s.email.toLowerCase().includes(search)
    );
  }

  if (roleFilter !== "all") {
    staff = staff.filter((s) => s.role === roleFilter);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Empleados</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {staff.length} empleado{staff.length !== 1 ? "s" : ""} en tu equipo
          </p>
        </div>
        <AddStaffForm />
      </div>

      {/* Role reference */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { role: "OWNER", icon: Shield, desc: "Acceso total — analíticas, empleados, configuración, clientes." },
          { role: "ADMIN", icon: Users, desc: "Analíticas y gestión de clientes. Sin acceso a empleados." },
          { role: "STAFF", icon: Users, desc: "Solo acceso a clientes y registro de visitas." },
        ].map(({ role, icon: Icon, desc }) => {
          const r = ROLE_LABELS[role];
          return (
            <div key={role} className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full border ${r.className}`}>
                  {r.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <StaffFilterBar search={search} roleFilter={roleFilter} />

      {/* Staff list */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {/* Owner row */}
        <div className="flex items-center gap-4 px-6 py-4 bg-emerald-50/60 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {session.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{session.user.name} <span className="text-gray-400 font-normal">(tú)</span></p>
            <p className="text-xs text-gray-400">{session.user.email}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${ROLE_LABELS.OWNER.className}`}>
            Dueño
          </span>
        </div>

        {/* Staff rows */}
        {staff.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mb-3">
              <Users size={24} />
            </div>
            <p className="text-sm font-semibold text-gray-900">Sin empleados con estos filtros</p>
            <p className="text-xs text-gray-400 mt-1">Ajusta los filtros o agrega un nuevo empleado.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {staff.map((s) => {
              const badge = ROLE_LABELS[s.role] ?? ROLE_LABELS.STAFF;
              return (
                <li key={s.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.email}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${badge.className}`}>
                    {badge.label}
                  </span>
                  <p className="hidden sm:block text-xs text-gray-400 shrink-0 w-24 text-right">
                    {new Date(s.createdAt).toLocaleDateString("es-MX")}
                  </p>
                  <RemoveStaffButton staffId={s.id} name={s.name} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
