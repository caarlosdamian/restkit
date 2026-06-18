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
    // Preserve who first added each existing line, and how much the kitchen has
    // already prepared, so attribution + KDS progress survive a full items
    // replace. preparedQty is capped at the (possibly reduced) new quantity;
    // extra units added in a later round re-appear as pending on the KDS.
    const prevById = new Map(
      order.items.map((i) => [String(i.productId), { addedBy: i.addedBy, preparedQty: i.preparedQty ?? 0 }])
    );
    order.items = body.items.map((i: IOrderItem) => {
      const prev = prevById.get(String(i.productId));
      return {
        ...i,
        addedBy: prev?.addedBy ?? actingStaffId,
        preparedQty: Math.min(prev?.preparedQty ?? 0, i.quantity),
      };
    });
    order.total = body.items.reduce(
      (sum: number, i: IOrderItem) => sum + i.price * i.quantity,
      0
    );
  }

  if (body.status) {
    order.status = body.status;
    // First time the ticket reaches the kitchen → stamp the aging clock.
    if (body.status === 'IN_KITCHEN' && !order.kitchenAt) {
      order.kitchenAt = new Date();
    }
    if (body.status === 'PAID') {
      // Generate a short ticket number from the ObjectId
      order.ticketNumber = order._id.toString().slice(-6).toUpperCase();
      if (body.paymentMethod) order.paymentMethod = body.paymentMethod;
      if (body.amountReceived != null) {
        order.amountReceived = Number(body.amountReceived);
        order.change = Math.max(0, Number(body.amountReceived) - order.total);
      }
    }
    // Free the table when the order closes (paid or cancelled).
    if (body.status === 'PAID' || body.status === 'CANCELLED') {
      order.closedAt = new Date();
      await Table.updateOne(
        { _id: order.tableId },
        { $set: { isOccupied: false }, $unset: { assignedStaffId: '' } }
      );
    }
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
