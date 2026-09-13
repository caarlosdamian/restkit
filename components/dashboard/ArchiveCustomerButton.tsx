"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw } from "lucide-react";

/**
 * "Eliminar cliente" — which archives rather than deletes.
 *
 * The confirm names what actually survives, because the honest answer is not
 * what the word suggests: the person leaves the roster, the till lookup and the
 * scanner, but their visit history stays and so does any balance. Saying
 * "se eliminará permanentemente" would be a lie, and saying nothing leaves an
 * owner assuming it.
 *
 * ⚠️ An outstanding cashback balance or an unclaimed reward gets spelled out
 * before the confirm. That is money and a promise owed to somebody who may walk
 * in tomorrow holding a wallet pass, and archiving puts them out of reach of
 * the till lookup — so it is the one thing an owner must not find out
 * afterwards.
 */
export default function ArchiveCustomerButton({
  customerId,
  name,
  cashbackBalance = 0,
  pendingRewards = 0,
  archived = false,
  variant = "icon",
}: {
  customerId: string;
  name: string;
  cashbackBalance?: number;
  pendingRewards?: number;
  archived?: boolean;
  variant?: "icon" | "full";
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function archive() {
    const owed: string[] = [];
    if (cashbackBalance > 0) owed.push(`un saldo de $${cashbackBalance.toLocaleString("es-MX")}`);
    if (pendingRewards > 0) {
      owed.push(`${pendingRewards} premio${pendingRewards === 1 ? "" : "s"} sin entregar`);
    }

    const warning = owed.length
      ? `\n\nOJO: ${name} tiene ${owed.join(" y ")}. Al archivarlo no vas a poder encontrarlo al cobrar, así que no podrá usarlo hasta que lo restaures.`
      : "";

    if (
      !confirm(
        `¿Eliminar a ${name}?\n\n` +
          "Desaparece de tus clientes, de la búsqueda al cobrar y del escáner, y su tarjeta deja de actualizarse.\n\n" +
          "Su historial de visitas se conserva y puedes restaurarlo cuando quieras." +
          warning
      )
    ) {
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar el cliente.");
      return;
    }
    router.refresh();
  }

  async function restore() {
    setBusy(true);
    const res = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo restaurar el cliente.");
      return;
    }
    router.refresh();
  }

  if (archived) {
    return (
      <button
        onClick={restore}
        disabled={busy}
        title="Restaurar cliente"
        className={
          variant === "full"
            ? "inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            : "p-2 rounded-lg text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
        }
      >
        <RotateCcw size={15} />
        {variant === "full" && (busy ? "Restaurando…" : "Restaurar cliente")}
      </button>
    );
  }

  return (
    <button
      onClick={archive}
      disabled={busy}
      title="Eliminar cliente"
      className={
        variant === "full"
          ? "inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          : "p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      }
    >
      <Trash2 size={15} />
      {variant === "full" && (busy ? "Eliminando…" : "Eliminar cliente")}
    </button>
  );
}
