"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Undo2, ChevronDown, Loader2 } from "lucide-react";

export interface HistoryEntry {
  _id: string;
  type: "ACCRUAL" | "REVERSAL" | "REWARD_REDEMPTION";
  mechanic: "sellos" | "cashback";
  delta: number;
  orderTotal?: number;
  tableName?: string;
  createdAt: string;
  reversed: boolean;
}

interface Props {
  customerId: string;
  initial: { entries: HistoryEntry[]; total: number; hasMore: boolean };
}

const MXN = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function describe(e: HistoryEntry) {
  if (e.type === "REWARD_REDEMPTION") {
    return e.mechanic === "sellos"
      ? { label: "Premio entregado", tone: "amber" as const }
      : { label: `Usó ${MXN(Math.abs(e.delta))} de saldo`, tone: "amber" as const };
  }
  if (e.type === "REVERSAL") {
    return { label: "Reversa", tone: "rose" as const };
  }
  return {
    label: e.tableName ? `Compra · ${e.tableName}` : "Compra",
    tone: "emerald" as const,
  };
}

const TONES = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
};

/**
 * The purchase history, dashboard-only. The cardholder never sees this — their
 * pass and the public card page show the current number and nothing else.
 */
export default function CustomerHistory({ customerId, initial }: Props) {
  const [entries, setEntries] = useState(initial.entries);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  /**
   * ⚠️ Re-sync when the server sends a new history.
   *
   * `useState(initial.entries)` reads its argument on the FIRST render only, so
   * without this the list is frozen at whatever was on screen when the page
   * mounted. Recording a sale from `RecordVisitButton` calls `router.refresh()`,
   * which re-runs the server component and hands us a fresh `initial` — and the
   * list silently ignored it. The stamp counter above updated (it is rendered by
   * the server component directly) while "Historial de compras" kept showing the
   * old movements, which is what made it look like the sale had not registered.
   *
   * Removing a purchase never showed the bug because `remove()` below calls
   * `setEntries` with the server's response itself.
   *
   * Comparing by reference is what makes this safe: a client-only re-render
   * (any `setState` here) keeps the same props object, so this does not fire;
   * only a genuine server render produces a new one. Paging back to page 0 is
   * deliberate — the list changed underneath, so continuing to append to a
   * stale page 3 would interleave old and new movements.
   */
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setEntries(initial.entries);
    setHasMore(initial.hasMore);
    setTotal(initial.total);
    setPage(0);
  }

  async function loadMore() {
    setBusy("more");
    try {
      const res = await fetch(`/api/customers/${customerId}/history?page=${page + 1}`);
      const data = await res.json();
      if (res.ok) {
        setEntries((prev) => [...prev, ...data.entries]);
        setHasMore(data.hasMore);
        setPage(page + 1);
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(visitId: string) {
    setBusy(visitId);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo quitar la compra");
        return;
      }
      setEntries(data.entries);
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(0);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
          <History size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Historial de compras</p>
          <p className="text-xs text-gray-500">
            {total} {total === 1 ? "movimiento" : "movimientos"} · sólo visible para ti
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin movimientos todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((e) => {
            const { label, tone } = describe(e);
            const positive = e.delta > 0;
            const canRemove =
              !e.reversed &&
              e.type !== "REVERSAL" &&
              !(e.type === "REWARD_REDEMPTION" && e.mechanic === "sellos");

            return (
              <li key={e._id} className="flex items-center gap-3 py-3">
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${TONES[tone]}`}
                >
                  {e.mechanic === "sellos"
                    ? `${positive ? "+" : ""}${e.delta}`
                    : `${positive ? "+" : "−"}${MXN(Math.abs(e.delta))}`}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      e.reversed ? "text-gray-400 line-through" : "text-gray-900"
                    }`}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(e.createdAt).toLocaleString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {e.orderTotal ? ` · ${MXN(e.orderTotal)}` : ""}
                  </p>
                </div>

                {canRemove ? (
                  <button
                    onClick={() => remove(e._id)}
                    disabled={busy === e._id}
                    title="Quitar esta compra"
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-rose-600 hover:border-rose-200 disabled:opacity-40 transition-colors"
                  >
                    {busy === e._id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Undo2 size={13} />
                    )}
                    Quitar
                  </button>
                ) : (
                  <span className="shrink-0 w-[4.9rem]" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={busy === "more"}
          className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {busy === "more" ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
          Ver más
        </button>
      )}
    </div>
  );
}
