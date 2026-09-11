"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, LinkIcon, Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

/**
 * "Olvidé mi contraseña", step two: choose the new one.
 *
 * The token never reaches this page from a form — it arrives in the query
 * string because better-auth's `/api/auth/reset-password/:token` endpoint has
 * already looked it up and redirected here. That hop is why an expired link
 * shows its own screen instead of failing after someone has typed a password
 * twice: better-auth redirects with `?error=INVALID_TOKEN` and no token at all.
 */
function ResetPasswordForm() {
  const sp = useSearchParams();
  const token = sp.get("token");
  const linkError = sp.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    !loading && password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !canSubmit) return;

    setLoading(true);
    setError("");

    const { error: authError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    setLoading(false);

    if (authError) {
      setError(messageFor(authError.code, authError.message));
      return;
    }

    setDone(true);
  }

  /* ── The link itself was no good ──────────────────────────────────────── */
  if (!token || linkError) {
    return (
      <Shell title="Este enlace ya no sirve" subtitle="Los enlaces vencen a la hora y sólo se pueden usar una vez.">
        <div className="space-y-5 text-sm text-gray-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <LinkIcon size={20} />
          </div>
          <p>
            Puede que haya pasado demasiado tiempo, que ya lo hayas usado, o que el correo
            haya cortado la dirección en dos renglones al copiarla.
          </p>
          <Link
            href="/recuperar"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-all no-underline"
          >
            Pedir un enlace nuevo
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── Done ─────────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <Shell title="Listo" subtitle="Tu contraseña quedó actualizada.">
        <div className="space-y-5 text-sm text-gray-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Check size={20} />
          </div>
          <p>
            Por seguridad cerramos todas las sesiones abiertas. Si hay un turno abierto en
            la terminal del punto de venta, alguien va a tener que volver a entrar ahí con
            la contraseña nueva.
          </p>
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-all no-underline"
          >
            Iniciar sesión
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── The form ─────────────────────────────────────────────────────────── */
  return (
    <Shell title="Elige una contraseña" subtitle={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <Field
          id="password"
          label="Nueva contraseña"
          value={password}
          onChange={setPassword}
          reveal={reveal}
          onToggleReveal={() => setReveal((r) => !r)}
          autoFocus
          error={tooShort ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.` : undefined}
        />
        <Field
          id="confirm"
          label="Repítela"
          value={confirm}
          onChange={setConfirm}
          reveal={reveal}
          error={mismatch ? "No coinciden." : undefined}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 transition-all"
        >
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>

        <p className="text-xs text-gray-500">
          Al guardarla se cierran todas las sesiones abiertas, incluida la terminal del POS.
        </p>
      </form>
    </Shell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  reveal,
  onToggleReveal,
  error,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  reveal: boolean;
  onToggleReveal?: () => void;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          id={id}
          name={id}
          type={reveal ? "text" : "password"}
          required
          autoFocus={autoFocus}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
          placeholder="••••••••"
        />
        {onToggleReveal && (
          <button
            type="button"
            onClick={onToggleReveal}
            aria-label={reveal ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
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
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-4">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

/** better-auth speaks English and in codes; the person reading has one job. */
function messageFor(code: string | undefined, fallback?: string): string {
  switch (code) {
    case "INVALID_TOKEN":
      return "El enlace venció o ya se usó. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.";
    case "PASSWORD_TOO_SHORT":
      return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    case "PASSWORD_TOO_LONG":
      return "Esa contraseña es demasiado larga.";
    default:
      return fallback || "No pudimos guardar la contraseña. Inténtalo de nuevo.";
  }
}

export default function ResetPasswordPage() {
  // useSearchParams opts the tree into client-side rendering, which Next
  // requires a Suspense boundary for — without it the production build fails.
  return (
    <Suspense fallback={<Shell title="Un momento" subtitle="Abriendo tu enlace…">{null}</Shell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
