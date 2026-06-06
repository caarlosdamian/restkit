import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Table from "@/models/Table";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import TableLayoutEditor from "@/components/pos/TableLayoutEditor";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function TableLayoutPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!["OWNER", "ADMIN"].includes(session.user.role)) redirect("/dashboard/pos");

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);

  const [tables, staff] = await Promise.all([
    Table.find({ businessId: bId, isActive: true }).sort({ number: 1 }),
    mongoose.connection
      .collection("user")
      .find({ businessId: bId }, { projection: { name: 1 } })
      .toArray(),
  ]);

  const serialized = tables.map((t) => ({
    id: t._id.toString(),
    number: t.number,
    name: t.name,
    capacity: t.capacity,
    position: t.position,
    section: t.section,
    assignedStaffId: t.assignedStaffId?.toString(),
  }));

  const serializedStaff = staff.map((s: any) => ({
    id: s._id.toString(),
    name: s.name as string,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/pos" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Distribuir Mesas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Organiza visualmente tus mesas y establece la capacidad de cada una.
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-900">💡 Cómo usar:</p>
        <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
          <li>Arrastra las mesas para posicionarlas en el mapa</li>
          <li>Haz clic en una mesa para editar capacidad y sección</li>
          <li>Usa las secciones para agrupar mesas por área (Bar, Patio, VIP, etc.)</li>
          <li>Los cambios se guardan en el servidor automáticamente</li>
        </ul>
      </div>

      {/* Layout editor */}
      <TableLayoutEditor tables={serialized} staff={serializedStaff} />
    </div>
  );
}
