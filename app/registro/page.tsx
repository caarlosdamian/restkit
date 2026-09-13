'use client';

import { Suspense, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Mail, Lock, User, UserPlus } from 'lucide-react';
import { getPlan, TRIAL_DAYS } from '@/lib/plans';

function RegistroForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** The address we told to go check its mail. Also the "done" flag. */
  const [sentTo, setSentTo] = useState('');
  const [resent, setResent] = useState(false);
  // useSearchParams (not window.location): it's reactive and correct during
  // client-side navigations, where reading window.location at render time can
  // race the URL update and silently drop the ?plan= the visitor clicked on
  // the pricing section.
  const sp = useSearchParams();
  const plan = sp.get('plan');
  const period = sp.get('period');

  const selectedPlan = getPlan(plan);

  /**
   * One server call does the whole sign-up. It used to be two from here —
   * `authClient.signUp.email`, then `POST /api/business` with the id that came
   * back — which cannot work now that sign-up returns no session.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') || '');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email,
          password: formData.get('password'),
          businessName: formData.get('businessName'),
          plan,
          period,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'No se pudo crear la cuenta.');
        return;
      }

      setSentTo(email);
    } catch {
      setError('Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResent(false);
    await authClient.sendVerificationEmail({ email: sentTo, callbackURL: '/dashboard' });
    setResent(true);
  }

  if (sentTo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Mail size={22} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Revisa tu correo
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Enviamos un enlace a <strong className="text-gray-900">{sentTo}</strong>. Ábrelo para
            confirmar tu correo y entrar — el enlace vence en una hora.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Hasta que lo abras no vas a poder iniciar sesión, ni en el panel ni en la terminal.
          </p>
          <div className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 text-left">
            <p className="text-sm text-gray-500">
              ¿No llegó? Revisa la carpeta de spam, o
              <button
                onClick={resend}
                className="ml-1 font-semibold text-emerald-600 hover:text-emerald-700"
              >
                envíalo de nuevo
              </button>
              .
            </p>
            {resent && (
              <p className="mt-2 text-sm font-medium text-emerald-600">
                Listo, lo enviamos otra vez.
              </p>
            )}
          </div>
          <Link
            href="/login"
            className="mt-7 inline-block text-sm font-semibold text-gray-500 no-underline hover:text-gray-900"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-900 font-bold text-xl tracking-tight no-underline mb-4"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="8" fill="#10b981" />
              <path d="M10 16L16 10L22 16L16 22Z" fill="white" />
            </svg>
            RestKit
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-4">
            Crea tu cuenta
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {selectedPlan
              ? `Plan ${selectedPlan.name} · ${TRIAL_DAYS} días de prueba gratis, sin tarjeta`
              : `${TRIAL_DAYS} días de prueba gratis, sin tarjeta de crédito`}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="businessName"
                className="block text-sm font-medium text-gray-900 mb-1.5"
              >
                Nombre de tu Negocio
              </label>
              <div className="relative">
                <Store
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  required
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  placeholder="La Cafetería Urbana"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-900 mb-1.5"
              >
                Tu Nombre
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  placeholder="Juan Pérez"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-900 mb-1.5"
              >
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
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-900 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
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

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500-dark focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 transition-all"
            >
              {loading ? (
                'Registrando...'
              ) : (
                <>
                  Registrarse <UserPlus size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="text-emerald-500 font-semibold hover:text-emerald-500-dark transition-colors no-underline"
          >
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

// useSearchParams requires a Suspense boundary for static prerendering.
export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroForm />
    </Suspense>
  );
}
