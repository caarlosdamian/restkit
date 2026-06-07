import { NextResponse } from 'next/server';
import POSSession from '@/models/POSSession';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import { getBusinessContext } from '@/lib/pos-auth';

export async function GET() {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  // Get the current open session
  const posSession = await POSSession.findOne({
    businessId: ctx.businessId,
    status: 'OPEN',
  });

  if (!posSession) {
    return NextResponse.json({ session: null });
  }

  // Calculate current sales from paid orders since session started
  const paidOrders = await Order.find({
    businessId: ctx.businessId,
    status: 'PAID',
    closedAt: { $gte: posSession.startedAt },
  });

  const totals = {
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    totalSales: 0,
  };

  paidOrders.forEach((order) => {
    if (order.paymentMethod === 'CASH') totals.cashSales += order.total;
    else if (order.paymentMethod === 'CARD') totals.cardSales += order.total;
    else if (order.paymentMethod === 'TRANSFER') totals.transferSales += order.total;
    totals.totalSales += order.total;
  });

  return NextResponse.json({
    session: {
      id: posSession._id.toString(),
      staffName: posSession.staffName,
      openingBalance: posSession.openingBalance,
      startedAt: posSession.startedAt,
      totalSales: totals.totalSales,
      totalOrders: paidOrders.length,
      cashSales: totals.cashSales,
      cardSales: totals.cardSales,
      transferSales: totals.transferSales,
    },
  });
}
