import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Order from '@/models/Order';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';
import { verifyWaiterToken, signWaiterToken } from '@/lib/waiter-token';

export async function GET(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get('tableId');

  await dbConnect();

  const filter: Record<string, unknown> = {
    businessId: ctx.businessId,
    status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] },
  };

  if (tableId) filter.tableId = new mongoose.Types.ObjectId(tableId);

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { tableId, items, status } = await req.json();

  if (!tableId) return NextResponse.json({ error: 'tableId requerido' }, { status: 400 });

  // The acting waiter (if a valid PIN token is present); otherwise the
  // logged-in terminal user (e.g. the manager) owns the order.
  const hdrs = await headers();
  const waiter = verifyWaiterToken(hdrs.get('x-waiter-token'), ctx.businessIdStr);
  const actingStaffId = new mongoose.Types.ObjectId(waiter?.staffId ?? ctx.userId);

  // Verify table belongs to business
  const table = await Table.findOne({
    _id: new mongoose.Types.ObjectId(tableId),
    businessId: ctx.businessId,
  });
  if (!table) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });

  // Ensure no active order exists for this table
  const existing = await Order.findOne({
    tableId: new mongoose.Types.ObjectId(tableId),
    businessId: ctx.businessId,
    status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] },
  });
  if (existing) return jsonWithRefreshedToken(existing, waiter, ctx.businessIdStr);

  const incoming: Array<{ price: number; quantity: number }> = items ?? [];
  const total = incoming.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // A new order may be created straight into the kitchen (waiter taps "Enviar a
  // cocina" on a fresh table). Stamp kitchenAt so the KDS can order/age it.
  const goesToKitchen = status === 'IN_KITCHEN';

  const order = await Order.create({
    tableId: new mongoose.Types.ObjectId(tableId),
    tableName: table.name || `Mesa ${table.number}`,
    businessId: ctx.businessId,
    staffId: actingStaffId,
    status: goesToKitchen ? 'IN_KITCHEN' : 'OPEN',
    items: (items ?? []).map((i: Record<string, unknown>) => ({ ...i, addedBy: actingStaffId })),
    total,
    ...(goesToKitchen ? { kitchenAt: new Date() } : {}),
  });

  return jsonWithRefreshedToken(order, waiter, ctx.businessIdStr, 201);
}

// Rolls the waiter's activity window forward by re-issuing a token on each
// successful action, so an actively-working waiter never re-types the PIN.
function jsonWithRefreshedToken(
  body: unknown,
  waiter: { staffId: string; staffName: string } | null,
  businessId: string,
  status = 200
) {
  const res = NextResponse.json(body, { status });
  if (waiter) {
    res.headers.set('x-waiter-token', signWaiterToken(waiter.staffId, waiter.staffName, businessId));
  }
  return res;
}
