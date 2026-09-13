"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** Set when sign-in was refused only because the address is unconfirmed. */
  const [unverified, setUnverified] = useState("");
  const [resent, setResent] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    setUnverified("");
    setResent(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await authClient.signIn.email({
        email,
        password,
      }, {
        onRequest: () => setLoading(true),
        onResponse: () => setLoading(false),
        onError: (ctx) => {
          // An unconfirmed address is refused with 403 EMAIL_NOT_VERIFIED.
          // Telling someone their password is wrong when it is not is how a
          // sign-up gets abandoned, so this gets its own message and a way out.
          if (ctx.error.code === "EMAIL_NOT_VERIFIED" || ctx.error.status === 403) {
            setUnverified(email);
            return;
          }
          setError(ctx.error.message || "Credenciales inválidas");
        },
        onSuccess: () => {
          router.push("/dashboard");
          router.refresh();
        }
      });
    } catch (err) {
      setError("Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  async function resend() {
    setResent(false);
    await authClient.sendVerificationEmail({ email: unverified, callbackURL: "/dashboard" });
    setResent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-900 font-bold text-xl tracking-tight no-underline mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#10b981" />
              <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
            </svg>
            RestKit
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-4">
            Inicia sesión
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Accede al panel de control de tu negocio
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-900">Contraseña</label>
                <Link href="/recuperar" className="text-xs font-semibold text-emerald-500 hover:text-emerald-600 transition-colors no-underline">
                  ¿La olvidaste?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Amber, not red: nothing is wrong with what they typed. */}
            {unverified && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Falta confirmar tu correo</p>
                <p className="mt-1 leading-relaxed">
                  Te enviamos un enlace a <strong>{unverified}</strong>. Ábrelo para activar tu
                  cuenta y entrar.
                </p>
                <button
                  type="button"
                  onClick={resend}
                  className="mt-2 font-semibold text-amber-900 underline underline-offset-2"
                >
                  Enviar el enlace de nuevo
                </button>
                {resent && <p className="mt-1.5 font-medium">Listo, lo enviamos otra vez.</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500-dark focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 transition-all"
            >
              {loading ? (
                "Iniciando sesión..."
              ) : (
                <>Iniciar sesión <LogIn size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="text-emerald-500 font-semibold hover:text-emerald-500-dark transition-colors no-underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
