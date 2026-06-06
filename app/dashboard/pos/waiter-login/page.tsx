import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WaiterLoginForm from "@/components/pos/WaiterLoginForm";
import { LogIn } from "lucide-react";

export default async function WaiterLoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

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
            <h1 className="text-2xl font-extrabold text-gray-900">Ingresa tu número</h1>
            <p className="text-sm text-gray-500">Tu código de empleado para continuar</p>
          </div>

          {/* Form */}
          <WaiterLoginForm businessId={session.user.businessId} userRole={session.user.role} />

          {/* Info */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong>✓ Ingresa tu número de empleado (001, 002, etc.)</strong>
            </p>
            <p className="text-xs text-blue-800 mt-2 leading-relaxed">
              Verás todas las mesas disponibles. Selecciona una y comienza a tomar pedidos.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          ¿Olvidaste tu número? Pregunta al gerente
        </p>
      </div>
    </div>
  );
}
