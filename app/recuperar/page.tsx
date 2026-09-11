"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MailCheck, Send } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/**
 * "Olvidé mi contraseña", step one: ask for the link.
 *
 * ⚠️ **The answer is the same whether or not the address has an account.** It
 * has to be: this page is public and unauthenticated, so a form that said "no
 * encontramos esa cuenta" would be a free tool for checking which of a list of
 * emails belongs to a RestKit customer. better-auth already answers uniformly
 * (it even burns the same time generating a throwaway token so the *duration*
 * doesn't give it away) — this screen must not undo that by rendering the
 * difference. Hence: one success state, always, and an error only when the
 * request itself failed to go through.
 */
export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // `redirectTo` is where better-auth sends the browser once it has checked
    // the token. A relative path on purpose — it is validated against the
    // trusted origins, and a relative one is always this deployment.
    const { error: authError } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/restablecer",
    });

    setLoading(false);

    if (authError) {
      // Reaching here means the REQUEST failed (offline, rate limited), never
      // "that account doesn't exist" — that path returns success.
      setError(
        authError.status === 429
          ? "Demasiados intentos. Espera unos minutos y vuelve a probar."
          : "No pudimos enviar el correo. Revisa tu conexión e inténtalo de nuevo.",
      );
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-900 font-bold text-xl tracking-tight no-underline mb-4"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#10b981" />
              <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
            </svg>
            RestKit
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-4">
            {sent ? "Revisa tu correo" : "¿Olvidaste tu contraseña?"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {sent
              ? "Si esa dirección tiene una cuenta, le acabamos de enviar un enlace."
              : "Escribe tu correo y te mandamos un enlace para elegir una nueva."}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          {sent ? (
            <div className="space-y-4 text-sm text-gray-500">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <MailCheck size={20} />
              </div>
              <p className="text-gray-900 font-medium break-all">{email.trim()}</p>
              <p>
                El enlace vence en una hora y sólo sirve una vez. Si no aparece en unos
                minutos, revisa la carpeta de correo no deseado.
              </p>
              <p>
                Al cambiar la contraseña se cierran las sesiones abiertas, así que vas a
                tener que volver a entrar en la terminal del punto de venta.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-sm font-semibold text-emerald-500 hover:text-emerald-600 transition-colors"
              >
                Usar otro correo
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || email.trim().length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 transition-all"
              >
                {loading ? "Enviando..." : <>Enviar enlace <Send size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold hover:text-emerald-600 transition-colors no-underline"
          >
            <ArrowLeft size={14} />
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
