"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrderBuilder from "@/components/pos/OrderBuilder";

interface EmployeeSession {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  businessId: string;
  role: string;
}

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

interface Order {
  _id: string;
  status: string;
  items: any[];
  total: number;
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

interface Business {
  name: string;
  ticket: TicketConfig;
}

interface Table {
  _id: string;
  number: number;
  name: string;
}

export default function POSOrderPage({ params }: { params: Promise<{ tableId: string }> }) {
  const router = useRouter();
  const [tableId, setTableId] = useState<string | null>(null);
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Check POS employee session
      const stored = window.localStorage.getItem("posEmployeeSession");
      if (!stored) {
        router.push("/pos");
        return;
      }

      const employeeSession = JSON.parse(stored) as EmployeeSession;
      setSession(employeeSession);

      // Get table ID from params
      const p = await params;
      setTableId(p.tableId);

      // Fetch data
      await fetchData(p.tableId, employeeSession);
    })();
  }, [params, router]);

  async function fetchData(tId: string, employeeSession: EmployeeSession) {
    try {
      // Fetch table
      const tableRes = await fetch(`/api/tables/${tId}`);
      if (tableRes.ok) {
        setTable(await tableRes.json());
      }

      // Fetch business
      const bizRes = await fetch("/api/settings");
      if (bizRes.ok) {
        const bizData = await bizRes.json();
        setBusiness(bizData);
      }

      // Fetch products
      const productsRes = await fetch("/api/products");
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }

      // Fetch active order for table
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: tId }),
      });
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        setOrder(orderData);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading || !tableId || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!table || !business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">Error al cargar la mesa o negocio</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <OrderBuilder
      tableId={tableId}
      tableName={table.name || `Mesa ${table.number}`}
      businessName={business.name}
      staffName={session.employeeName}
      ticketConfig={business.ticket}
      products={products}
      initialOrder={order}
    />
  );
}
