"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, AlertCircle, UtensilsCrossed, Mail, Lock, ClipboardList } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function POSLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // The POS is its own section. Entry depends on the POS login marker
  // (`posEmployeeSession`), NOT the dashboard's Better Auth cookie — so being
  // logged into /dashboard does not auto-enter the POS, and there is no
  // redirect loop with /pos/dashboard (which gates on the same marker).
  useEffect(() => {
    if (window.localStorage.getItem("posEmployeeSession")) {
      router.replace("/pos/dashboard");
    }
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    await authClient.signIn.email(
      { email: email.trim(), password },
      {
        onError: (ctx) => {
          setError(ctx.error.message || "Credenciales inválidas");
          setLoading(false);
        },
        onSuccess: async () => {
          // Cache a display-only snapshot. This is NOT used for authorization;
          // the server always derives identity from the session cookie.
          const { data } = await authClient.getSession();
          const user = data?.user as
            | { name?: string; role?: string; businessId?: string }
            | undefined;
          window.localStorage.setItem(
            "posEmployeeSession",
            JSON.stringify({
              employeeName: user?.name ?? "",
              role: user?.role ?? "STAFF",
              businessId: user?.businessId ?? "",
            })
          );
          router.push("/pos/dashboard");
          router.refresh();
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <UtensilsCrossed size={40} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">RestKit</h1>
          <p className="text-sm text-gray-600 mt-1">Sistema de Punto de Venta</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-white shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-gray-900">Abrir terminal</h2>
            <p className="text-sm text-gray-500 mt-1">
              Un gerente inicia sesión para habilitar esta terminal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Correo del gerente
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gerente@correo.com"
                  disabled={loading}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3">
                <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!email.trim() || !password || loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <LogIn size={18} />
              {loading ? "Validando..." : "Abrir terminal"}
            </button>
          </form>

          {/* Info */}
          <div className="space-y-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
              <ClipboardList size={15} /> Cómo funciona:
            </p>
            <ul className="text-xs text-amber-800 space-y-1.5">
              <li className="flex gap-2">
                <span className="shrink-0">1.</span>
                <span>El gerente abre la terminal con su cuenta al iniciar el turno</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">2.</span>
                <span>La terminal queda activa hasta el cierre de caja</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">3.</span>
                <span>Los meseros se identifican con su PIN al tomar comandas</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          ¿Eres propietario?{" "}
          <a href="/login" className="font-semibold text-amber-600 hover:underline">
            Ir a administrador
          </a>
        </p>
      </div>
    </div>
  );
}
