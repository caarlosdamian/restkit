import { NextResponse } from 'next/server';
import Order from '@/models/Order';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';

type Params = Promise<{ orderId: string }>;

const ACTIVE = ['OPEN', 'IN_KITCHEN', 'READY'] as const;

// Move an active order to a different (free) table. The old table is freed.
export async function POST(req: Request, { params }: { params: Params }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  const { tableId } = await req.json();

  if (!tableId) return NextResponse.json({ error: 'tableId requerido' }, { status: 400 });

  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    businessId: ctx.businessId,
    status: { $in: ACTIVE },
  });
  if (!order) return NextResponse.json({ error: 'Orden activa no encontrada' }, { status: 404 });

  const targetId = new mongoose.Types.ObjectId(tableId);
  if (order.tableId.equals(targetId)) {
    return NextResponse.json(order); // already there, no-op
  }

  // Target table must exist in this business and be active.
  const target = await Table.findOne({ _id: targetId, businessId: ctx.businessId, isActive: true });
  if (!target) return NextResponse.json({ error: 'Mesa destino no encontrada' }, { status: 404 });

  // Target must not already have an active order.
  const occupied = await Order.findOne({
    tableId: targetId,
    businessId: ctx.businessId,
    status: { $in: ACTIVE },
  });
  if (occupied) {
    return NextResponse.json({ error: 'La mesa destino ya tiene una orden activa' }, { status: 409 });
  }

  const oldTableId = order.tableId;
  order.tableId = targetId;
  order.tableName = target.name || `Mesa ${target.number}`;
  await order.save();

  // Free the table the customers left.
  await Table.updateOne(
    { _id: oldTableId },
    { $set: { isOccupied: false }, $unset: { assignedStaffId: '' } }
  );

  return NextResponse.json(order);
}
