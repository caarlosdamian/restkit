"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

/**
 * Change the signed-in account's password.
 *
 * Goes through better-auth's own `/change-password`, which verifies the current
 * password and rehashes with the same parameters the rest of the app uses. This
 * form never touches a hash — a second implementation of password handling is
 * how one of them ends up weaker than the other.
 *
 * ⚠️ Only OWNER/ADMIN reach this page. **Waiters have no password at all** —
 * they are identified by a POS PIN (`user.pinHash`, set from /dashboard/staff),
 * which is a different credential with a different threat model. This form is
 * not the place to reset one.
 */

export default function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // Signing every other device out is the point of most password changes — but
  // in this product one of those devices is the POS terminal, which would drop
  // the floor staff mid-shift. So it is a choice, made on purpose, with the
  // consequence named.
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const unchanged = next.length > 0 && next === current;
  const ready =
    current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && confirm === next && !unchanged && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const { error: err } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: revokeOthers,
      });
      if (err) {
        setError(messageFor(err.code, err.message));
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch {
      setError("No se pudo cambiar la contraseña. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
          <KeyRound size={15} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">Contraseña</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Con la que entras a <span className="font-medium text-gray-700">{email}</span>.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        <Field label="Contraseña actual">
          <input
            type={reveal ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
            placeholder="••••••••"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nueva contraseña"
            error={tooShort ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.` : unchanged ? "Es la misma de siempre." : undefined}
          >
            <input
              type={reveal ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirmar" error={mismatch ? "No coincide." : undefined}>
            <input
              type={reveal ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
              placeholder="••••••••"
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
          {reveal ? "Ocultar contraseñas" : "Ver lo que escribo"}
        </button>

        <label className="flex items-start gap-2.5 rounded-xl bg-gray-50 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={revokeOthers}
            onChange={(e) => setRevokeOthers(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
          />
          <span className="text-xs leading-snug text-gray-600">
            <span className="font-semibold text-gray-900">Cerrar sesión en los demás dispositivos.</span>{" "}
            Recomendado si crees que alguien más conoce tu contraseña.{" "}
            <span className="text-gray-500">
              Incluye la terminal del POS: si hay un turno abierto, alguien tendrá que volver
              a entrar.
            </span>
          </span>
        </label>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!ready}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            {saving ? "Cambiando…" : "Cambiar contraseña"}
          </button>
          {done && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <Check size={15} /> Contraseña actualizada
            </span>
          )}
        </div>
      </div>
    </form>
  );
}

/** better-auth answers in English with a stable code; the owner reads Spanish. */
function messageFor(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "INVALID_PASSWORD":
      return "La contraseña actual no es correcta.";
    case "PASSWORD_TOO_SHORT":
      return `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    case "PASSWORD_TOO_LONG":
      return "La nueva contraseña es demasiado larga.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "Esta cuenta no tiene contraseña configurada.";
    default:
      return fallback || "No se pudo cambiar la contraseña.";
  }
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
