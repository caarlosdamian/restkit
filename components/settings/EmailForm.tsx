"use client";

import { useState } from "react";
import { AtSign, Loader2, MailCheck, Send } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/**
 * Change the address the signed-in account uses to log in.
 *
 * Goes through better-auth's `/change-email`, which never writes the new
 * address on the strength of this request alone: it mails a confirmation link
 * to the NEW address and only moves the account once someone opens it. That is
 * the whole security model here, because every user in this app has
 * `emailVerified: false` — see the `changeEmail` note in `lib/auth.ts`.
 *
 * ⚠️ **The success state is deliberately identical for an address that is
 * already registered.** better-auth answers `{ status: true }` without sending
 * anything when the new address belongs to someone else, precisely so the form
 * cannot be used to test which addresses have RestKit accounts. Rendering a
 * "ya está en uso" error here would hand that oracle straight back — the same
 * reasoning that gives `/recuperar` one success screen. The person who really
 * owns the address simply never gets a mail.
 */
export default function EmailForm({ email }: { email: string }) {
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = next.trim().toLowerCase();
  const malformed = trimmed.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const unchanged = trimmed.length > 0 && trimmed === email.trim().toLowerCase();
  const ready = trimmed.length > 0 && !malformed && !unchanged && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    setSentTo(null);
    try {
      const { error: err } = await authClient.changeEmail({
        newEmail: trimmed,
        // Where the confirmation link lands once it has done its work.
        callbackURL: "/dashboard/settings?correo=confirmado",
      });
      if (err) {
        setError(messageFor(err.code, err.message));
        return;
      }
      setSentTo(trimmed);
      setNext("");
    } catch {
      setError("No se pudo enviar la confirmación. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
          <AtSign size={15} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">Correo de la cuenta</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Hoy entras con <span className="font-medium text-gray-700">{email}</span>.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {sentTo ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 flex items-start gap-2.5">
            <MailCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="text-sm leading-snug text-emerald-800">
              <p className="font-semibold">Te enviamos un correo a {sentTo}.</p>
              <p className="mt-1 text-emerald-700">
                Ábrelo y confirma para terminar el cambio. El enlace vence en una hora.
                Mientras tanto sigues entrando con {email}.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Nuevo correo
              </label>
              <input
                type="email"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="email"
                placeholder="nombre@negocio.mx"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              {malformed && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  Escribe un correo válido.
                </p>
              )}
              {unchanged && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  Ya es el correo de la cuenta.
                </p>
              )}
            </div>

            <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs leading-snug text-gray-600">
              <span className="font-semibold text-gray-900">
                Este correo también es tu usuario en la terminal del POS.
              </span>{" "}
              Al confirmarlo tendrás que entrar con la nueva dirección en el panel y en la
              terminal. Tu contraseña no cambia, y nada se modifica hasta que abras el
              enlace que te enviemos.
            </p>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </p>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={!ready}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {saving ? "Enviando…" : "Enviar confirmación"}
              </button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}

/** better-auth answers in English with a stable code; the owner reads Spanish. */
function messageFor(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "CHANGE_EMAIL_DISABLED":
      return "El cambio de correo está desactivado. Avísale a soporte.";
    case "INVALID_EMAIL":
      return "Escribe un correo válido.";
    case "USER_NOT_FOUND":
      return "No encontramos tu cuenta. Vuelve a iniciar sesión e inténtalo otra vez.";
    default:
      return fallback || "No se pudo enviar la confirmación.";
  }
}
