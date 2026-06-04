import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Order from '@/models/Order';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get('tableId');

  await dbConnect();

  const filter: Record<string, unknown> = {
    businessId: new mongoose.Types.ObjectId(session.user.businessId),
    status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] },
  };

  if (tableId) filter.tableId = new mongoose.Types.ObjectId(tableId);

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { tableId, items } = await req.json();

  if (!tableId) return NextResponse.json({ error: 'tableId requerido' }, { status: 400 });

  // Verify table belongs to business
  const table = await Table.findOne({
    _id: tableId,
    businessId: session.user.businessId,
  });
  if (!table) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });

  // Ensure no active order exists for this table
  const existing = await Order.findOne({
    tableId,
    businessId: session.user.businessId,
    status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] },
  });
  if (existing) return NextResponse.json(existing);

  const total = (items ?? []).reduce(
    (sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity,
    0
  );

  const order = await Order.create({
    tableId,
    tableName: table.name || `Mesa ${table.number}`,
    businessId: session.user.businessId,
    staffId: session.user.id,
    items: items ?? [],
    total,
  });

  return NextResponse.json(order, { status: 201 });
}
