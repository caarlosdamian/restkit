"use client";

import { Printer } from "lucide-react";
import { printReceipt, type ReceiptData } from "@/lib/receipt-html";

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

interface ReprintButtonProps {
  order: {
    ticketNumber: string;
    tableName: string;
    items: Array<{ name: string; quantity: number; price: number; notes?: string }>;
    total: number;
    paymentMethod: string;
    amountReceived?: number;
    change?: number;
    closedAt: Date;
  };
  businessName: string;
  ticketConfig?: TicketConfig;
}

export default function ReprintButton({ order, businessName, ticketConfig = {} }: ReprintButtonProps) {
  function handlePrint() {
    const data: ReceiptData = {
      ...order,
      businessName,
      ...ticketConfig,
      staffName: "",
      closedAt: new Date(order.closedAt),
    };
    printReceipt(data);
  }

  return (
    <button
      onClick={handlePrint}
      className="p-2 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors shrink-0"
      title="Reimprimir ticket"
    >
      <Printer size={15} />
    </button>
  );
}
