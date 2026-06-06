import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Order, { IOrderItem } from '@/models/Order';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

type Params = Promise<{ orderId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId), businessId });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  const body = await req.json();

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId), businessId });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  if (body.items !== undefined) {
    order.items = body.items;
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
  return NextResponse.json(order);
}
