import { NextResponse } from 'next/server';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';

type Params = Promise<{ orderId: string }>;

// Kitchen bump. Two shapes:
//   { all: true }                 → mark every line prepared (bump whole ticket)
//   { productId, prepared: bool } → toggle a single line done / not done
// When all lines are prepared the ticket flips to READY (waiter sees "lista
// para cobrar"). Un-bumping a line on a READY ticket pulls it back to the
// kitchen. Terminal-session scoped — never trusts client businessId.
export async function PATCH(req: Request, { params }: { params: Params }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  // An aborted/empty request body must be a 400, not an unhandled 500.
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'productId o all requerido' }, { status: 400 });
  }

  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    businessId: ctx.businessId,
    status: { $in: ['IN_KITCHEN', 'READY'] },
  });
  if (!order) {
    return NextResponse.json({ error: 'Ticket de cocina no encontrado' }, { status: 404 });
  }

  if (body.all) {
    order.items.forEach((i) => {
      i.preparedQty = i.quantity;
    });
  } else if (body.productId) {
    const line = order.items.find((i) => String(i.productId) === String(body.productId));
    if (!line) {
      return NextResponse.json({ error: 'Producto no encontrado en el ticket' }, { status: 404 });
    }
    line.preparedQty = body.prepared === false ? 0 : line.quantity;
  } else {
    return NextResponse.json({ error: 'productId o all requerido' }, { status: 400 });
  }

  // A ticket is ready once every line is fully prepared.
  const allDone = order.items.every((i) => (i.preparedQty ?? 0) >= i.quantity);
  order.status = allDone ? 'READY' : 'IN_KITCHEN';

  await order.save();

  return NextResponse.json({ _id: String(order._id), status: order.status });
}
