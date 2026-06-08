"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, ChefHat, CreditCard, ArrowLeft, Search, Check, Printer } from "lucide-react";
import PaymentModal from "./PaymentModal";
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

export default function OrderBuilder({ tableId, tableName, businessName, staffName, ticketConfig = {}, products, initialOrder }: OrderBuilderProps) {
  const router = useRouter();
  const [sessionValid, setSessionValid] = useState(true);
  const [orderId, setOrderId]   = useState(initialOrder?._id ?? null);
  const [status, setStatus]     = useState(initialOrder?.status ?? "OPEN");
  const [items, setItems]       = useState<OrderItem[]>(initialOrder?.items ?? []);
  const [saving, setSaving]     = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch]     = useState("");
  const [activeTab, setActiveTab] = useState<"menu" | "order">("menu");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setActiveTab("order");
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

  // Send to kitchen (works from any active status)
  async function sendToKitchen() {
    if (items.length === 0) return;
    setSaving(true);
    try {
      let oid = orderId;
      if (!oid) {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...waiterHeader() },
          body: JSON.stringify({ tableId, items }),
        });
        refreshWaiterFromResponse(res);
        const data = await res.json();
        if (!res.ok) return;
        oid = data._id;
        setOrderId(oid);
      } else {
        const res = await fetch(`/api/orders/${oid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...waiterHeader() },
          body: JSON.stringify({ items, status: "IN_KITCHEN" }),
        });
        refreshWaiterFromResponse(res);
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
      tableName,
      staffName,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <button
          onClick={() => router.push("/pos/dashboard")}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
          title="Volver"
        >
          <ArrowLeft size={18} />
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
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    activeCategory === cat
                      ? "bg-emerald-500 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300"
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
                        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[0.65rem] font-bold flex items-center justify-center">
                          {inOrder.quantity}
                        </span>
                      )}
                      {/* Pending badge (if some not yet sent) */}
                      {pendingQty > 0 && (
                        <span className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-amber-400 text-white text-[0.6rem] font-bold flex items-center justify-center">
                          +{pendingQty}
                        </span>
                      )}
                      <p className="text-[0.8rem] font-bold text-gray-900 leading-tight mb-1">{product.name}</p>
                      {product.description && (
                        <p className="text-[0.7rem] text-gray-400 leading-tight mb-2 line-clamp-2">{product.description}</p>
                      )}
                      <p className="text-sm font-extrabold text-emerald-600">${product.price.toFixed(2)}</p>
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
                        <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                        {pendingQty > 0 && !isPaid && (
                          <span className="text-[0.6rem] font-bold bg-amber-400 text-white px-1.5 py-0.5 rounded-full shrink-0">
                            +{pendingQty} nuevo{pendingQty > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[0.7rem] text-emerald-600 font-bold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    {!isPaid ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-red-300 hover:text-red-500 transition-colors"
                        >
                          {item.quantity === 1 ? <Trash2 size={11} /> : <Minus size={11} />}
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-gray-500 shrink-0">×{item.quantity}</span>
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3 text-sm font-semibold disabled:opacity-40 transition-colors"
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white py-3 text-sm font-semibold disabled:opacity-40 transition-colors"
                  >
                    <Check size={16} /> Marcar como lista
                  </button>
                )}

                {/* Print pre-bill (cuenta) — to bring to the customer before paying */}
                <button
                  onClick={printPreBill}
                  disabled={items.length === 0}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 py-3 text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  <Printer size={16} /> Imprimir cuenta
                </button>

                {/* Collect payment */}
                <button
                  onClick={() => setShowPayment(true)}
                  disabled={items.length === 0 || saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 py-3 text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  <CreditCard size={16} /> Cobrar ${total.toFixed(2)}
                </button>

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
