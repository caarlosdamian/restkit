import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Order, { IOrderItem } from '@/models/Order';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';
import { verifyWaiterToken, signWaiterToken } from '@/lib/waiter-token';

type Params = Promise<{ orderId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    businessId: ctx.businessId,
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  const body = await req.json();

  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    businessId: ctx.businessId,
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  // Acting waiter from the PIN token, or the logged-in terminal user.
  const hdrs = await headers();
  const waiter = verifyWaiterToken(hdrs.get('x-waiter-token'), ctx.businessIdStr);
  const actingStaffId = new mongoose.Types.ObjectId(waiter?.staffId ?? ctx.userId);

  if (body.items !== undefined) {
    // Preserve who first added each existing line; stamp new lines with the
    // acting waiter so attribution survives a full items replace.
    const prevById = new Map(order.items.map((i) => [String(i.productId), i.addedBy]));
    order.items = body.items.map((i: IOrderItem) => ({
      ...i,
      addedBy: prevById.get(String(i.productId)) ?? actingStaffId,
    }));
    order.total = body.items.reduce(
      (sum: number, i: IOrderItem) => sum + i.price * i.quantity,
      0
    );
  }

  if (body.status) {
    order.status = body.status;
    if (body.status === 'PAID') {
      order.closedAt = new Date();
      // Generate a short ticket number from the ObjectId
      order.ticketNumber = order._id.toString().slice(-6).toUpperCase();
      if (body.paymentMethod) order.paymentMethod = body.paymentMethod;
      if (body.amountReceived != null) {
        order.amountReceived = Number(body.amountReceived);
        order.change = Math.max(0, Number(body.amountReceived) - order.total);
      }
      // Clear staff from table when order is paid
      await Table.updateOne(
        { _id: order.tableId },
        { $unset: { assignedStaffId: '' } }
      );
    }
    if (body.status === 'CANCELLED') order.closedAt = new Date();
  }

  if (body.notes !== undefined) order.notes = body.notes;

  await order.save();

  const res = NextResponse.json(order);
  if (waiter) {
    res.headers.set(
      'x-waiter-token',
      signWaiterToken(waiter.staffId, waiter.staffName, ctx.businessIdStr)
    );
  }
  return res;
}
