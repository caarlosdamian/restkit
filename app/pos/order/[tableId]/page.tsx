'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrderBuilder from '@/components/pos/OrderBuilder';
import WaiterPinModal from '@/components/pos/WaiterPinModal';
import { clearActiveWaiter } from '@/lib/waiter-session';

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
  items: Array<{ productId: string; name: string; price: number; quantity: number; notes?: string }>;
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
  iva?: number;
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

export default function POSOrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const router = useRouter();
  const [tableId, setTableId] = useState<string | null>(null);
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  // Who is taking this order. null = not yet resolved (show PIN);
  // { name } = a waiter via PIN; { name: manager } = "continue as manager".
  const [waiter, setWaiter] = useState<{ staffName: string } | null | undefined>(undefined);
  // Set when the server refuses the order on subscription grounds (402), so a
  // lapsed business gets a reason instead of an order builder that silently
  // fails to save.
  const [blocked, setBlocked] = useState<string | null>(null);

  async function fetchData(tId: string, employeeSession: EmployeeSession) {
    try {
      // Fetch table
      const tableRes = await fetch(`/api/tables/${tId}?businessId=${employeeSession.businessId}`);
      if (tableRes.ok) {
        setTable(await tableRes.json());
      }

      // Fetch business
      const bizRes = await fetch('/api/settings');
      if (bizRes.ok) {
        const bizData = await bizRes.json();
        setBusiness(bizData);
      }

      // Fetch products
      const productsRes = await fetch('/api/products');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }

      // Fetch active order for table
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: tId }),
      });
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        setOrder(orderData);
      } else if (orderRes.status === 402) {
        const data = await orderRes.json().catch(() => ({}));
        setBlocked(data.error || 'Tu suscripción expiró.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      // Check POS employee session
      const stored = window.localStorage.getItem('posEmployeeSession');
      if (!stored) {
        router.push('/pos');
        return;
      }

      const employeeSession = JSON.parse(stored) as EmployeeSession;
      setSession(employeeSession);

      // A table may only be opened during an open shift. The caja screen is
      // where the subscription 402 is surfaced, so without this check a table
      // URL typed or bookmarked directly walked straight past the money gate.
      const sesRes = await fetch('/api/pos-session/current');
      const sesData = sesRes.ok ? await sesRes.json() : null;
      if (!sesData?.session) {
        router.push('/pos/dashboard');
        return;
      }

      // Require a fresh PIN every time a table is opened, so each order is
      // attributed to whoever is actually taking it. Any previous waiter is
      // cleared on entry (and again on leave, below).
      clearActiveWaiter();

      // Get table ID from params
      const p = await params;
      setTableId(p.tableId);

      // Fetch data
      await fetchData(p.tableId, employeeSession);
    })();

    return () => clearActiveWaiter();
  }, [params, router]);

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

  if (blocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <p className="text-base font-semibold text-gray-900">No se puede abrir la orden</p>
          <p className="mt-2 text-sm text-gray-500">{blocked}</p>
          <button
            onClick={() => router.push('/pos/dashboard')}
            className="mt-5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Volver a mesas
          </button>
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

  const tableLabel = table.name || `Mesa ${table.number}`;

  // Gate: require a waiter (PIN) or an explicit "continue as manager" before
  // building the order.
  if (waiter === undefined) {
    return (
      <div className="min-h-screen bg-gray-50">
        <WaiterPinModal
          tableName={tableLabel}
          onAuthenticated={(w) =>
            setWaiter({ staffName: w?.staffName ?? session.employeeName })
          }
        />
      </div>
    );
  }

  return (
    <OrderBuilder
      tableId={tableId}
      tableName={tableLabel}
      businessName={business.name}
      staffName={waiter?.staffName || session.employeeName}
      ticketConfig={business.ticket}
      products={products}
      initialOrder={order}
    />
  );
}
