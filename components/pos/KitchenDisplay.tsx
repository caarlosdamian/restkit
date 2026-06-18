"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Check, ArrowLeft, AlarmClock } from "lucide-react";

interface KitchenItem {
  productId: string;
  name: string;
  quantity: number;
  preparedQty: number;
  notes?: string | null;
}

interface Ticket {
  _id: string;
  tableName: string;
  notes?: string | null;
  kitchenAt: string;
  items: KitchenItem[];
}

// Aging thresholds (seconds) → how long a ticket has been in the kitchen.
const WARN_AFTER = 5 * 60;
const LATE_AFTER = 10 * 60;
const POLL_MS = 5000;

function elapsedSeconds(kitchenAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(kitchenAt).getTime()) / 1000));
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function KitchenDisplay() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  // Lines being bumped — keeps the tap responsive before the next poll.
  const bumping = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/kitchen", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/pos");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Poll the feed.
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Tick the aging clock once a second (independent of the network poll).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Toggle a single line done / not done (optimistic).
  async function toggleLine(ticket: Ticket, item: KitchenItem) {
    const key = `${ticket._id}:${item.productId}`;
    if (bumping.current.has(key)) return;
    bumping.current.add(key);

    const done = item.preparedQty >= item.quantity;
    const nextPrepared = done ? 0 : item.quantity;

    setTickets((prev) =>
      prev.map((t) =>
        t._id === ticket._id
          ? {
              ...t,
              items: t.items.map((i) =>
                i.productId === item.productId ? { ...i, preparedQty: nextPrepared } : i
              ),
            }
          : t
      )
    );

    try {
      await fetch(`/api/pos/kitchen/${ticket._id}/bump`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.productId, prepared: !done }),
      });
      await load();
    } finally {
      bumping.current.delete(key);
    }
  }

  // Bump the whole ticket → READY, removed from the feed.
  async function bumpTicket(ticket: Ticket) {
    setTickets((prev) => prev.filter((t) => t._id !== ticket._id));
    await fetch(`/api/pos/kitchen/${ticket._id}/bump`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await load();
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/pos/dashboard")}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            title="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <ChefHat size={22} className="text-amber-400" />
          <h1 className="text-xl font-extrabold tracking-tight">Cocina</h1>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
          <AlarmClock size={16} />
          {tickets.length} {tickets.length === 1 ? "orden activa" : "órdenes activas"}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[60dvh] items-center justify-center text-neutral-500">
          Cargando cocina…
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex h-[70dvh] flex-col items-center justify-center text-center text-neutral-600">
          <ChefHat size={56} className="mb-4 text-neutral-700" />
          <p className="text-lg font-semibold text-neutral-400">Sin órdenes en cocina</p>
          <p className="text-sm">Las nuevas comandas aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {tickets.map((ticket) => {
            const secs = elapsedSeconds(ticket.kitchenAt, now);
            const late = secs >= LATE_AFTER;
            const warn = !late && secs >= WARN_AFTER;

            const tone = late
              ? { ring: "border-rose-500", head: "bg-rose-600", timer: "text-rose-300" }
              : warn
              ? { ring: "border-amber-400", head: "bg-amber-500", timer: "text-amber-200" }
              : { ring: "border-emerald-500", head: "bg-emerald-600", timer: "text-emerald-200" };

            const doneCount = ticket.items.filter((i) => i.preparedQty >= i.quantity).length;

            return (
              <div
                key={ticket._id}
                className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-neutral-900 ${tone.ring} ${
                  late ? "animate-pulse" : ""
                }`}
              >
                {/* Ticket header */}
                <div className={`flex items-center justify-between px-4 py-2.5 ${tone.head}`}>
                  <span className="text-lg font-extrabold text-white">{ticket.tableName}</span>
                  <span className={`rounded-md bg-black/25 px-2 py-0.5 font-mono text-base font-bold tabular-nums text-white`}>
                    {formatElapsed(secs)}
                  </span>
                </div>

                {/* Order-level note (allergies, "para llevar", etc.) */}
                {ticket.notes && (
                  <p className="border-b border-neutral-800 bg-neutral-800/60 px-4 py-2 text-sm font-semibold text-amber-300">
                    {ticket.notes}
                  </p>
                )}

                {/* Items */}
                <div className="flex-1 divide-y divide-neutral-800">
                  {ticket.items.map((item) => {
                    const done = item.preparedQty >= item.quantity;
                    return (
                      <button
                        key={item.productId}
                        onClick={() => toggleLine(ticket, item)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors active:scale-[0.99] ${
                          done ? "bg-neutral-900/40" : "hover:bg-neutral-800/60"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                            done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-neutral-600"
                          }`}
                        >
                          {done && <Check size={15} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`flex items-baseline gap-2 text-base font-bold ${
                              done ? "text-neutral-500 line-through" : "text-neutral-50"
                            }`}
                          >
                            <span className="shrink-0 text-amber-400">{item.quantity}×</span>
                            <span className="truncate">{item.name}</span>
                          </span>
                          {item.notes && (
                            <span
                              className={`mt-0.5 block text-sm font-semibold ${
                                done ? "text-neutral-600" : "text-amber-300"
                              }`}
                            >
                              ↳ {item.notes}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Footer — progress + bump whole ticket */}
                <div className="flex items-center gap-3 border-t border-neutral-800 p-3">
                  <span className="text-xs font-semibold text-neutral-500">
                    {doneCount}/{ticket.items.length} listos
                  </span>
                  <button
                    onClick={() => bumpTicket(ticket)}
                    className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 active:scale-95"
                  >
                    <Check size={16} /> Listo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
