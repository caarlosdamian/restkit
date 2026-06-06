import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import StaffLoginForm from "@/components/pos/StaffLoginForm";
import { LogIn } from "lucide-react";

export default async function StaffLoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "STAFF") redirect("/dashboard/pos");

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl bg-white shadow-2xl p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <LogIn size={32} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold text-gray-900">Iniciar sesión</h1>
            <p className="text-sm text-gray-500">Ingresa tu número de empleado para continuar</p>
          </div>

          {/* Form */}
          <StaffLoginForm />

          {/* Info */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong>Nota:</strong> Tu número de empleado está configurado en tu perfil. Si no lo conoces, contacta al gerente.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          ¿Necesitas ayuda? Contacta con la administración
        </p>
      </div>
    </div>
  );
}
