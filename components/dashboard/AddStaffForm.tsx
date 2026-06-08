"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Check, CheckCircle2 } from "lucide-react";

export default function AddStaffForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [role, setRole] = useState("STAFF");
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const employeeNumber = fd.get("employeeNumber") as string;
    const name = fd.get("name") as string;
    const currentRole = fd.get("role") as string;

    try {
      const pin = (fd.get("pin") as string)?.trim();
      const body: any = {
        name,
        employeeNumber,
        role: currentRole,
        ...(pin ? { pin } : {}),
      };

      // Email + password only required for ADMIN
      if (currentRole === "ADMIN") {
        body.email = fd.get("email");
        body.password = fd.get("password");
      } else if (currentRole === "STAFF") {
        // STAFF: auto-generate credentials (email not displayed, never used)
        body.email = `emp${employeeNumber}@restkit.local`;
        body.password = Math.random().toString(36).slice(-8);
      }

      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear empleado");
      setSuccess(`${name} fue agregado exitosamente`);
      setError("");
      // Reset form and reload page after brief delay

      
      (form.current as HTMLFormElement).reset()
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setError("");
          setSuccess("");
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm"
      >
        <UserPlus size={15} /> Agregar Empleado
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-7">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold text-gray-900">Nuevo Empleado</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" ref={form}>
          {/* Role selector */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Tipo de empleado
            </label>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              <option value="STAFF">Mesero — Toma pedidos en mesas</option>
              <option value="ADMIN">Gerente — Acceso a analíticas y configuración</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="Ej. María García"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Employee Number */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Número de empleado <span className="text-red-500">*</span>
            </label>
            <input
              name="employeeNumber"
              required
              placeholder="Ej. 001, 002, 003..."
              maxLength={10}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            <p className="text-xs text-gray-400 mt-1">
              {role === "STAFF" ? "Identifica al empleado en el POS" : "Número identificativo único"}
            </p>
          </div>

          {/* PIN — used to identify the waiter at the table on the POS terminal */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              PIN del POS <span className="text-gray-400 font-normal normal-case">(4 a 6 dígitos)</span>
            </label>
            <input
              name="pin"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              placeholder="Ej. 1234"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-[0.3em] text-gray-900 placeholder:tracking-normal placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            <p className="text-xs text-gray-400 mt-1">
              Lo teclea al tomar comandas en la mesa. Puedes dejarlo vacío y asignarlo después.
            </p>
          </div>

          {/* Email (only for ADMIN) */}
          {role === "ADMIN" && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Correo electrónico <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required={role === "ADMIN"}
                placeholder="gerente@ejemplo.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          )}

          {/* Password (only for ADMIN) */}
          {role === "ADMIN" && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                name="password"
                type="password"
                required={role === "ADMIN"}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          )}

          {/* Info box */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
            {role === "STAFF" ? (
              <>
                <p className="flex items-center gap-1 font-semibold"><Check size={13} /> Mesero</p>
                <p className="mt-1">Solo necesita número de empleado para iniciar sesión en las mesas.</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1 font-semibold"><Check size={13} /> Gerente</p>
                <p className="mt-1">Necesita email y contraseña para acceder a configuración.</p>
              </>
            )}
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-600">
              <CheckCircle2 size={15} className="shrink-0" />
              {success}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creando..." : "Crear Empleado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
