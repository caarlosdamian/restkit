"use client";

import { useState } from "react";
import { X, Banknote, CreditCard, ArrowRightLeft, Printer, CheckCircle2, Gift, Wallet } from "lucide-react";
import { printReceipt, type ReceiptData } from "@/lib/receipt-html";
import CustomerAttach, { type AttachedCustomer } from "./CustomerAttach";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
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

interface PaymentModalProps {
  orderId: string;
  total: number;
  items: OrderItem[];
  tableName: string;
  businessName: string;
  staffName: string;
  ticketConfig?: TicketConfig;
  onClose: () => void;
  onPaid: () => void;
}

const METHODS: Array<{ key: PaymentMethod; label: string; icon: React.ReactNode }> = [
  { key: "CASH",     label: "Efectivo",       icon: <Banknote size={20} /> },
  { key: "CARD",     label: "Tarjeta",         icon: <CreditCard size={20} /> },
  { key: "TRANSFER", label: "Transferencia",   icon: <ArrowRightLeft size={20} /> },
];

export default function PaymentModal({
  orderId,
  total,
  items,
  tableName,
  businessName,
  staffName,
  ticketConfig = {},
  onClose,
  onPaid,
}: PaymentModalProps) {
  const [method, setMethod]             = useState<PaymentMethod>("CASH");
  // null until the cashier types: the prefill tracks what's actually due, so
  // applying a discount doesn't leave a stale amount in the box.
  const [typedAmount, setTyped]         = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [paid, setPaid]                 = useState(false);
  const [receiptData, setReceiptData]   = useState<ReceiptData | null>(null);
  const [customer, setCustomer]         = useState<AttachedCustomer | null>(null);
  const [useCashback, setUseCashback]   = useState(false);
  const [redeemReward, setRedeemReward] = useState(false);

  // Cashback comes off the bill; `total` stays gross so the ticket can show
  // the discount, and the drawer only ever expects the difference.
  const cashbackApplied = useCashback && customer ? customer.maxCashback : 0;
  const due = Math.max(0, total - cashbackApplied);

  const amountReceived = typedAmount ?? due.toFixed(2);
  const setAmount = (v: string) => setTyped(v);

  const change = method === "CASH"
    ? Math.max(0, parseFloat(amountReceived || "0") - due)
    : 0;

  const canConfirm =
    method !== "CASH" ||
    parseFloat(amountReceived || "0") >= due;

  async function handleConfirm() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        status: "PAID",
        paymentMethod: method,
      };
      if (method === "CASH") {
        body.amountReceived = parseFloat(amountReceived);
      }
      if (customer) {
        body.customerId = customer.id;
        if (cashbackApplied > 0) body.cashbackApplied = cashbackApplied;
        if (redeemReward) body.redeemReward = true;
      }

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return;

      const receipt: ReceiptData = {
        ticketNumber: data.ticketNumber ?? orderId.slice(-6).toUpperCase(),
        businessName,
        ...ticketConfig,
        tableName,
        staffName,
        items,
        total,
        paymentMethod: method,
        amountReceived: method === "CASH" ? parseFloat(amountReceived) : undefined,
        change: method === "CASH" ? change : undefined,
        closedAt: new Date(data.closedAt ?? Date.now()),
        cashbackApplied: cashbackApplied > 0 ? cashbackApplied : undefined,
        loyalty: data.loyalty
          ? {
              name: customer?.name ?? "",
              cardUrl: data.loyalty.cardUrl,
              mechanic: data.loyalty.mechanic,
              stamps: data.loyalty.stamps,
              required: data.loyalty.required,
              balance: data.loyalty.cashbackBalance,
              rewardReady: data.loyalty.rewardsPending > 0,
              unitPlural: customer?.unitPlural,
              qrDataUrl: data.loyalty.qrDataUrl,
            }
          : undefined,
      };

      setReceiptData(receipt);
      setPaid(true);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (receiptData) printReceipt(receiptData);
  }

  function handleDone() {
    onPaid();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* ── Paid confirmation ── */}
        {paid ? (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-900">¡Pago registrado!</p>
              <p className="text-sm text-gray-500 mt-1">{tableName} · ${total.toFixed(2)}</p>
              {receiptData?.change != null && receiptData.change > 0 && (
                <p className="text-lg font-bold text-emerald-600 mt-2">
                  Cambio: ${receiptData.change.toFixed(2)}
                </p>
              )}
            </div>

            {receiptData?.loyalty && (
              <div className="w-full rounded-2xl bg-gray-50 border border-gray-100 p-4 flex flex-col items-center gap-2">
                {receiptData.loyalty.rewardReady ? (
                  <p className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
                    <Gift size={15} /> ¡{receiptData.loyalty.name} ganó su premio!
                  </p>
                ) : receiptData.loyalty.mechanic === "cashback" ? (
                  <p className="text-sm font-semibold text-gray-700">
                    Saldo de {receiptData.loyalty.name}: ${(receiptData.loyalty.balance ?? 0).toFixed(2)}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-gray-700">
                    {receiptData.loyalty.name} · {receiptData.loyalty.stamps} de {receiptData.loyalty.required}
                  </p>
                )}
                {receiptData.loyalty.qrDataUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptData.loyalty.qrDataUrl}
                      alt="QR de la tarjeta de fidelidad"
                      width={112}
                      height={112}
                      className="rounded-xl bg-white p-1.5"
                    />
                    <p className="text-xs text-gray-400 text-center">
                      También va impreso en el ticket
                    </p>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-3 w-full pt-2">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Printer size={16} /> Imprimir ticket
              </button>
              <button
                onClick={handleDone}
                className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          /* ── Payment selection ── */
          <>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <p className="text-lg font-extrabold text-gray-900">Cobrar orden</p>
                <p className="text-sm text-gray-500">{tableName}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Total */}
              <div className="text-center py-3 bg-gray-50 rounded-2xl">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Total a cobrar</p>
                <p className="text-4xl font-extrabold tracking-tight text-gray-900">${due.toFixed(2)}</p>
                {cashbackApplied > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    ${total.toFixed(2)} − ${cashbackApplied.toFixed(2)} de saldo
                  </p>
                )}
              </div>

              <CustomerAttach orderTotal={total} value={customer} onChange={(c) => {
                setCustomer(c);
                setUseCashback(false);
                setRedeemReward(false);
              }} />

              {customer?.rewardsPending ? (
                <label className="flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redeemReward}
                    onChange={(e) => setRedeemReward(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <Gift size={16} className="text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-amber-900 flex-1">
                    Canjear premio · {customer.rewardDescription}
                  </span>
                </label>
              ) : null}

              {customer?.cashbackRedeemable && customer.maxCashback > 0 && (
                <label className="flex items-center gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCashback}
                    onChange={(e) => setUseCashback(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <Wallet size={16} className="text-emerald-600 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-900 flex-1">
                    Usar ${customer.maxCashback.toFixed(2)} de saldo
                  </span>
                </label>
              )}

              {/* Payment method */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Forma de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setMethod(key)}
                      className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-xs font-semibold transition-all ${
                        method === key
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash: amount received + change */}
              {method === "CASH" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Monto recibido
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                      <input
                        type="number"
                        min={due}
                        step={0.01}
                        value={amountReceived}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-3.5 rounded-xl border border-gray-200 text-xl font-bold text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Quick amount buttons */}
                  <div className="flex gap-2">
                    {[50, 100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(String(Math.ceil(due / amt) * amt))}
                        className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        ${Math.ceil(due / amt) * amt}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-emerald-700">Cambio</span>
                    <span className="text-xl font-extrabold text-emerald-700">
                      ${change.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white py-4 text-base font-bold disabled:opacity-40 active:scale-95 transition-all"
              >
                {loading ? "Procesando…" : "Confirmar pago"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
