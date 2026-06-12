"use client";

import { useState } from "react";
import { X, Banknote, CreditCard, ArrowRightLeft, Printer, CheckCircle2 } from "lucide-react";
import { printReceipt, type ReceiptData } from "@/lib/receipt-html";

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
  const [amountReceived, setAmount]     = useState<string>(total.toFixed(2));
  const [loading, setLoading]           = useState(false);
  const [paid, setPaid]                 = useState(false);
  const [receiptData, setReceiptData]   = useState<ReceiptData | null>(null);

  const change = method === "CASH"
    ? Math.max(0, parseFloat(amountReceived || "0") - total)
    : 0;

  const canConfirm =
    method !== "CASH" ||
    parseFloat(amountReceived || "0") >= total;

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
                <p className="text-4xl font-extrabold tracking-tight text-gray-900">${total.toFixed(2)}</p>
              </div>

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
                        min={total}
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
                        onClick={() => setAmount(String(Math.ceil(total / amt) * amt))}
                        className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        ${Math.ceil(total / amt) * amt}
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
