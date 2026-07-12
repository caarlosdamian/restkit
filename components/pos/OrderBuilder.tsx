"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, ChefHat, CreditCard, ArrowLeft, Search, Check, Printer, StickyNote, X, Keyboard, ArrowRightLeft } from "lucide-react";
import PaymentModal from "./PaymentModal";
import OnScreenKeyboard from "./OnScreenKeyboard";
import { waiterHeader, refreshWaiterFromResponse } from "@/lib/waiter-session";
import { printReceipt } from "@/lib/receipt-html";

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface TicketConfig {
  fiscalName?: string;
  rfc?: string;
  phone?: string;
  address?: string;
  fiscalAddress?: string;
  website?: string;
  footerMessage?: string;
  iva?: number;
}

interface OrderBuilderProps {
  tableId: string;
  tableName: string;
  businessName: string;
  staffName: string;
  ticketConfig?: TicketConfig;
  products: Product[];
  initialOrder?: {
    _id: string;
    status: string;
    items: OrderItem[];
    total: number;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN:       { label: "Abierta",           color: "bg-amber-50 text-amber-700 border-amber-200" },
  IN_KITCHEN: { label: "En cocina",         color: "bg-blue-50 text-blue-700 border-blue-200" },
  READY:      { label: "Lista para cobrar", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function OrderBuilder({ tableId: initialTableId, tableName: initialTableName, businessName, staffName, ticketConfig = {}, products, initialOrder }: OrderBuilderProps) {
  const router = useRouter();
  // Table can change if the order is moved to another table mid-service.
  const [tableId, setTableId] = useState(initialTableId);
  const [tableName, setTableName] = useState(initialTableName);
  const [sessionValid, setSessionValid] = useState(true);
  const [orderId, setOrderId]   = useState(initialOrder?._id ?? null);
  const [status, setStatus]     = useState(initialOrder?.status ?? "OPEN");
  const [items, setItems]       = useState<OrderItem[]>(initialOrder?.items ?? []);
  const [saving, setSaving]     = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch]     = useState("");
  const [activeTab, setActiveTab] = useState<"menu" | "order">("menu");
  // Per-item special note editor (allergies, "sin leche de vaca", etc.)
  const [noteEditing, setNoteEditing] = useState<{ productId: string; name: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  // Move-to-another-table flow
  const [showMove, setShowMove] = useState(false);
  const [moveTables, setMoveTables] = useState<{ _id: string; number: number; name?: string }[]>([]);
  const [moving, setMoving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const NOTE_PRESETS = [
    "Sin azúcar", "Sin leche de vaca", "Leche deslactosada",
    "Sin gluten", "Sin cebolla", "Alergia", "Para llevar", "Bien cocido",
  ];

  // Check if POS session is open
  useEffect(() => {
    checkPOSSession();
  }, []);

  async function checkPOSSession() {
    try {
      const res = await fetch("/api/pos-session/current");
      if (res.ok) {
        const data = await res.json();
        if (!data.session) {
          setSessionValid(false);
          router.push("/pos/dashboard");
        }
      }
    } catch (err) {
      console.error("Error checking POS session:", err);
    }
  }

  // Track what was last sent to the kitchen so we can highlight new additions
  const [kitchenSnapshot, setKitchenSnapshot] = useState<Map<string, number>>(
    () => new Map(
      (initialOrder?.status !== "OPEN" ? initialOrder?.items ?? [] : []).map(
        (i) => [i.productId, i.quantity]
      )
    )
  );

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const isPaid = status === "PAID" || status === "CANCELLED";

  // How many items are pending (not yet sent to kitchen)
  const pendingCount = items.reduce((sum, item) => {
    const sent = kitchenSnapshot.get(item.productId) ?? 0;
    return sum + Math.max(0, item.quantity - sent);
  }, 0);

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category)))];

  const visibleProducts = products.filter((p) => {
    if (!p.isAvailable) return false;
    if (activeCategory !== "all" && p.category !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  const scheduleSave = useCallback(
    (nextItems: OrderItem[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistItems(nextItems), 800);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId]
  );

  async function persistItems(nextItems: OrderItem[], nextStatus?: string) {
    setSaving(true);
    try {
      if (!orderId) {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...waiterHeader() },
          body: JSON.stringify({ tableId, items: nextItems }),
        });
        refreshWaiterFromResponse(res);
        const data = await res.json();
        if (res.ok) setOrderId(data._id);
      } else {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...waiterHeader() },
          body: JSON.stringify({ items: nextItems, ...(nextStatus ? { status: nextStatus } : {}) }),
        });
        refreshWaiterFromResponse(res);
      }
    } finally {
      setSaving(false);
    }
  }

  function addItem(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      const next = existing
        ? prev.map((i) => i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { productId: product._id, name: product.name, price: product.price, quantity: 1 }];
      scheduleSave(next);
      return next;
    });
    // Stay on the menu so the waiter can keep tapping products fast; the
    // sticky bottom bar shows the running total and the send-to-kitchen action.
  }

  function updateQty(productId: string, delta: number) {
    setItems((prev) => {
      const next = prev
        .map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0);
      scheduleSave(next);
      return next;
    });
  }

  // ── Per-item notes ──
  function openNote(item: OrderItem) {
    setNoteDraft(item.notes ?? "");
    setNoteEditing({ productId: item.productId, name: item.name });
  }

  function saveNote() {
    if (!noteEditing) return;
    const note = noteDraft.trim();
    setItems((prev) => {
      const next = prev.map((i) =>
        i.productId === noteEditing.productId ? { ...i, notes: note || undefined } : i
      );
      scheduleSave(next);
      return next;
    });
    setNoteEditing(null);
  }

  // ── Move order to another table ──
  async function openMove() {
    setShowMove(true);
    const res = await fetch("/api/waiter/available-tables", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      // Only tables that are free (no active order) and not the current one.
      setMoveTables(
        (data.tables ?? []).filter(
          (t: { _id: string; activeOrder?: unknown }) => !t.activeOrder && t._id !== tableId
        )
      );
    }
  }

  async function moveToTable(target: { _id: string; number: number; name?: string }) {
    if (!orderId || moving) return;
    setMoving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: target._id }),
      });
      if (res.ok) {
        setTableId(target._id);
        setTableName(target.name || `Mesa ${target.number}`);
        setShowMove(false);
        // Keep the URL in sync (so a reload loads the new table) without
        // remounting the page — avoids a spurious PIN prompt mid-service.
        window.history.replaceState(null, "", `/pos/order/${target._id}`);
      }
    } finally {
      setMoving(false);
    }
  }

  // Send to kitchen (works from any active status)
  async function sendToKitchen() {
    if (items.length === 0) return;
    // Cancel any pending debounced auto-save: this request persists the same
    // items, and a concurrent writer can lose (version conflict) leaving the
    // kitchen without the ticket while the UI says "En cocina".
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      let oid = orderId;
      if (!oid) {
        // Create the order already IN_KITCHEN so it lands on the kitchen
        // display immediately (a fresh table goes straight to cooking).
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...waiterHeader() },
          body: JSON.stringify({ tableId, items, status: "IN_KITCHEN" }),
        });
        refreshWaiterFromResponse(res);
        const data = await res.json();
        if (!res.ok) return;
        oid = data._id;
        setOrderId(oid);
        // If the debounced auto-save won the race, the POST returned that
        // already-existing OPEN order without applying IN_KITCHEN — patch it
        // explicitly so the ticket actually reaches the kitchen.
        if (data.status !== "IN_KITCHEN") {
          const patch = await fetch(`/api/orders/${oid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...waiterHeader() },
            body: JSON.stringify({ items, status: "IN_KITCHEN" }),
          });
          refreshWaiterFromResponse(patch);
          if (!patch.ok) return; // don't claim "En cocina" on failure
        }
      } else {
        const res = await fetch(`/api/orders/${oid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...waiterHeader() },
          body: JSON.stringify({ items, status: "IN_KITCHEN" }),
        });
        refreshWaiterFromResponse(res);
        if (!res.ok) return;
      }
      // Update snapshot so the new items no longer show as "pending"
      setKitchenSnapshot(new Map(items.map((i) => [i.productId, i.quantity])));
      setStatus("IN_KITCHEN");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(nextStatus: string) {
    setSaving(true);
    try {
      if (orderId) {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...waiterHeader() },
          body: JSON.stringify({ items, status: nextStatus }),
        });
        refreshWaiterFromResponse(res);
      }
      setStatus(nextStatus);
      if (nextStatus === "PAID" || nextStatus === "CANCELLED") {
        router.push("/pos/dashboard");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  // Print the pre-bill ("cuenta") to bring to the customer before paying.
  function printPreBill() {
    if (items.length === 0) return;
    printReceipt({
      preliminary: true,
      businessName,
      fiscalName: ticketConfig.fiscalName,
      rfc: ticketConfig.rfc,
      phone: ticketConfig.phone,
      address: ticketConfig.address,
      fiscalAddress: ticketConfig.fiscalAddress,
      website: ticketConfig.website,
      footerMessage: ticketConfig.footerMessage,
      iva: ticketConfig.iva,
      tableName,
      staffName,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, notes: i.notes })),
      total,
      closedAt: new Date(),
    });
  }

  const st = STATUS_LABELS[status];

  // ── render ────────────────────────────────────────────────────────────────

  if (!sessionValid) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-gray-500">Validando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh p-3 sm:p-5">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => router.push("/pos/dashboard")}
          className="p-3 rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-gray-500"
          title="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{tableName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {st && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${st.color}`}>
                {st.label}
              </span>
            )}
            {pendingCount > 0 && !isPaid && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
            {saving && <span className="text-xs text-gray-400">Guardando…</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-gray-900">${total.toFixed(2)}</p>
          <p className="text-xs text-gray-400">{items.reduce((s, i) => s + i.quantity, 0)} productos</p>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex lg:hidden gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {(["menu", "order"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors relative ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {tab === "menu" ? "Menú" : "Orden"}
            {tab === "order" && pendingCount > 0 && (
              <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-amber-500 text-white text-[0.6rem] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 min-h-0">

        {/* LEFT — Menu */}
        <div className={`flex flex-col min-h-0 ${activeTab === "order" ? "hidden lg:flex" : "flex"}`}>
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-base focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-5 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                    activeCategory === cat
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-white border-2 border-gray-200 text-gray-600 hover:border-emerald-300"
                  }`}
                >
                  {cat === "all" ? "Todos" : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {visibleProducts.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-sm text-gray-400">
                Sin productos en esta categoría
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visibleProducts.map((product) => {
                  const inOrder = items.find((i) => i.productId === product._id);
                  const sentQty = kitchenSnapshot.get(product._id) ?? 0;
                  const pendingQty = inOrder ? Math.max(0, inOrder.quantity - sentQty) : 0;

                  return (
                    <button
                      key={product._id}
                      onClick={() => !isPaid && addItem(product)}
                      disabled={isPaid}
                      className={`relative text-left rounded-2xl border p-4 transition-all ${
                        isPaid ? "opacity-50 cursor-not-allowed" : "hover:border-emerald-400 hover:shadow-md active:scale-95 cursor-pointer"
                      } ${inOrder ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white"}`}
                    >
                      {/* Total qty badge */}
                      {inOrder && (
                        <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                          {inOrder.quantity}
                        </span>
                      )}
                      {/* Pending badge (if some not yet sent) */}
                      {pendingQty > 0 && (
                        <span className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-amber-400 text-white text-[0.65rem] font-bold flex items-center justify-center">
                          +{pendingQty}
                        </span>
                      )}
                      <p className="text-sm font-bold text-gray-900 leading-tight mb-1">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-gray-400 leading-tight mb-2 line-clamp-2">{product.description}</p>
                      )}
                      <p className="text-base font-extrabold text-emerald-600">${product.price.toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Order panel */}
        <div className={`flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden ${activeTab === "menu" ? "hidden lg:flex" : "flex"}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Orden actual</p>
            {items.length > 0 && status === "OPEN" && (
              <button
                onClick={() => { setItems([]); scheduleSave([]); }}
                className="text-xs text-red-400 hover:text-red-600 font-semibold"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mb-3">
                  <ChefHat size={24} />
                </div>
                <p className="text-sm font-semibold text-gray-400">Sin productos</p>
                <p className="text-xs text-gray-300 mt-1">Agrega productos del menú</p>
              </div>
            ) : (
              items.map((item) => {
                const sentQty = kitchenSnapshot.get(item.productId) ?? 0;
                const pendingQty = Math.max(0, item.quantity - sentQty);
                const isNewItem = sentQty === 0;

                return (
                  <div
                    key={item.productId}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      isNewItem && !isPaid
                        ? "bg-amber-50 border border-amber-200"
                        : pendingQty > 0 && !isPaid
                        ? "bg-amber-50/60 border border-amber-100"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        {pendingQty > 0 && !isPaid && (
                          <span className="text-[0.6rem] font-bold bg-amber-400 text-white px-1.5 py-0.5 rounded-full shrink-0">
                            +{pendingQty} nuevo{pendingQty > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-emerald-600 font-bold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                      {item.notes && (
                        <p className="flex items-start gap-1 text-[0.7rem] text-amber-700 mt-0.5">
                          <StickyNote size={11} className="mt-0.5 shrink-0" />
                          <span className="wrap-break-word">{item.notes}</span>
                        </p>
                      )}
                    </div>

                    {!isPaid && (
                      <button
                        onClick={() => openNote(item)}
                        title="Agregar nota"
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-all ${
                          item.notes
                            ? "bg-amber-100 text-amber-600 border border-amber-200"
                            : "bg-white border border-gray-200 text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <StickyNote size={16} />
                      </button>
                    )}

                    {!isPaid ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:border-red-300 hover:text-red-500 active:scale-90 transition-all"
                        >
                          {item.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                        </button>
                        <span className="w-7 text-center text-base font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 active:scale-90 transition-all"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-base font-bold text-gray-500 shrink-0">×{item.quantity}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Total + actions */}
          <div className="border-t border-gray-100 p-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-500">Total</span>
              <span className="text-2xl font-extrabold text-gray-900">${total.toFixed(2)}</span>
            </div>

            {!isPaid && (
              <>
                {/* Send to kitchen — always visible when there are pending items or status is OPEN */}
                {(status === "OPEN" || pendingCount > 0) && (
                  <button
                    onClick={sendToKitchen}
                    disabled={items.length === 0 || saving}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3.5 text-base font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
                  >
                    <ChefHat size={16} />
                    {status === "OPEN"
                      ? "Enviar a cocina"
                      : `Enviar ${pendingCount} más a cocina`}
                  </button>
                )}

                {/* Mark as ready — only when IN_KITCHEN with nothing pending */}
                {status === "IN_KITCHEN" && pendingCount === 0 && (
                  <button
                    onClick={() => changeStatus("READY")}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 text-base font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
                  >
                    <Check size={16} /> Marcar como lista
                  </button>
                )}

                {/* Print pre-bill (cuenta) — to bring to the customer before paying */}
                <button
                  onClick={printPreBill}
                  disabled={items.length === 0}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 py-3.5 text-base font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  <Printer size={16} /> Imprimir cuenta
                </button>

                {/* Collect payment */}
                <button
                  onClick={() => setShowPayment(true)}
                  disabled={items.length === 0 || saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 py-3.5 text-base font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  <CreditCard size={16} /> Cobrar ${total.toFixed(2)}
                </button>

                {/* Move order to another table */}
                {orderId && (
                  <button
                    onClick={openMove}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 py-3.5 text-base font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
                  >
                    <ArrowRightLeft size={16} /> Cambiar de mesa
                  </button>
                )}

                <button
                  onClick={() => changeStatus("CANCELLED")}
                  disabled={saving}
                  className="w-full text-center text-xs text-red-400 hover:text-red-600 py-1 transition-colors"
                >
                  Cancelar orden
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar — send to kitchen fast, no scroll, no tab switch */}
      {!isPaid && activeTab === "menu" && items.length > 0 && (
        <div className="lg:hidden mt-3 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("order")}
            className="flex flex-col items-start px-3 py-2 rounded-xl border border-gray-200 bg-white active:scale-95 transition-transform"
          >
            <span className="text-[0.6rem] text-gray-400 leading-none">
              {items.reduce((s, i) => s + i.quantity, 0)} prod.
            </span>
            <span className="text-base font-extrabold text-gray-900 leading-tight">${total.toFixed(2)}</span>
          </button>
          {status === "OPEN" || pendingCount > 0 ? (
            <button
              onClick={sendToKitchen}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3.5 text-sm font-bold disabled:opacity-40 transition-colors"
            >
              <ChefHat size={18} />
              {status === "OPEN" ? "Enviar a cocina" : `Enviar ${pendingCount} a cocina`}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab("order")}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 text-emerald-700 py-3.5 text-sm font-bold"
            >
              <CreditCard size={16} /> Ir a cobrar
            </button>
          )}
        </div>
      )}

      {/* Move to another table */}
      {showMove && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4 max-h-[85dvh] flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-extrabold text-gray-900">Cambiar de mesa</p>
                <p className="text-sm text-gray-500">Mover la orden de {tableName} a otra mesa libre</p>
              </div>
              <button
                onClick={() => setShowMove(false)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {moveTables.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No hay mesas libres disponibles.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 overflow-y-auto">
                {moveTables.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => moveToTable(t)}
                    disabled={moving}
                    className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 active:scale-95 disabled:opacity-40 transition-all"
                  >
                    <span className="text-[0.6rem] font-bold uppercase tracking-wider text-emerald-500">Mesa</span>
                    <span className="text-2xl font-extrabold">{t.number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-item note editor */}
      {noteEditing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className={`w-full rounded-2xl bg-white shadow-2xl p-6 space-y-4 ${
              showKeyboard ? "max-w-xl" : "max-w-md"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-extrabold text-gray-900">Nota del producto</p>
                <p className="text-sm text-gray-500">{noteEditing.name}</p>
              </div>
              <button
                onClick={() => setNoteEditing(null)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              autoFocus
              rows={3}
              placeholder="Ej. Sin leche de vaca, alergia a nueces…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-base text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />

            {/* On-screen keyboard toggle — for devices without a native keyboard */}
            <button
              type="button"
              onClick={() => setShowKeyboard((s) => !s)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              <Keyboard size={16} />
              {showKeyboard ? "Ocultar teclado" : "Mostrar teclado en pantalla"}
            </button>

            {showKeyboard && <OnScreenKeyboard value={noteDraft} onChange={setNoteDraft} />}

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2">
              {NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() =>
                    setNoteDraft((d) => (d.trim() ? `${d.trim()}, ${preset}` : preset))
                  }
                  className="px-3 py-2 rounded-full bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              {noteDraft.trim() && (
                <button
                  onClick={() => setNoteDraft("")}
                  className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={saveNote}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-base font-bold active:scale-[0.98] transition-all"
              >
                Guardar nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && orderId && (
        <PaymentModal
          orderId={orderId}
          total={total}
          items={items}
          tableName={tableName}
          businessName={businessName}
          staffName={staffName}
          ticketConfig={ticketConfig}
          onClose={() => setShowPayment(false)}
          onPaid={() => {
            router.push("/pos/dashboard");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
