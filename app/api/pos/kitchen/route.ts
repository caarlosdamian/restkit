import { NextResponse } from 'next/server';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import { getBusinessContext } from '@/lib/pos-auth';

// Kitchen Display System feed: every ticket currently being cooked, oldest
// first (FIFO). Terminal-session scoped — businessId comes from the cookie.
export async function GET() {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  const orders = await Order.find({
    businessId: ctx.businessId,
    status: 'IN_KITCHEN',
  })
    .sort({ kitchenAt: 1, createdAt: 1 })
    .lean();

  const tickets = orders.map((o) => ({
    _id: String(o._id),
    tableName: o.tableName,
    notes: o.notes ?? null,
    // Fall back to createdAt for legacy tickets sent before kitchenAt existed.
    kitchenAt: (o.kitchenAt ?? o.createdAt) as Date,
    items: (o.items ?? []).map((i) => ({
      productId: String(i.productId),
      name: i.name,
      quantity: i.quantity,
      preparedQty: i.preparedQty ?? 0,
      notes: i.notes ?? null,
    })),
  }));

  return NextResponse.json({ tickets });
}
