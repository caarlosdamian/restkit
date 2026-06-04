"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, ArrowLeft } from "lucide-react";

export default function NewCustomerPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear cliente");
      }

      router.push("/dashboard/customers");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Clientes
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Nuevo Cliente</h1>
        <p className="text-sm text-gray-500 mt-1">Registra un cliente para su tarjeta de fidelidad.</p>
      </div>

      {/* Form card */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              id="name"
              required
              placeholder="Ej. María García"
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              name="email"
              id="email"
              placeholder="cliente@ejemplo.com"
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              id="phone"
              placeholder="+52 55 1234 5678"
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/dashboard/customers"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              <UserPlus size={16} />
              {loading ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
