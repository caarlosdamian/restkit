"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Self-enrolment, from a QR on the table. Asks for the least that identifies a
 * customer at the counter: a phone. The name is optional because a required
 * field is one more reason to abandon, and the till can fill it in later.
 */
export default function JoinForm({ slug, accent }: { slug: string; accent: string }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const digits = phone.replace(/\D/g, "");
  const ready = digits.length === 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/loyalty/join/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear tu tarjeta");
        return;
      }
      // Straight to the card, where the wallet buttons are.
      router.push(`/c/${data.token}`);
    } catch {
      setError("Revisa tu conexión e intenta de nuevo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-gray-500">
          Tu teléfono
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="55 1234 5678"
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-gray-500">
          Tu nombre <span className="font-medium normal-case tracking-normal text-gray-400">(opcional)</span>
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      <button
        type="submit"
        disabled={!ready || busy}
        style={{ backgroundColor: accent }}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-semibold text-white transition-opacity disabled:opacity-40"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : null}
        {busy ? "Creando…" : "Crear mi tarjeta"}
      </button>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <p className="text-center text-xs leading-relaxed text-gray-400">
        Usamos tu teléfono sólo para identificar tu tarjeta en el mostrador.
      </p>
    </form>
  );
}
