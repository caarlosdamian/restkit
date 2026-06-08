import { NextResponse } from 'next/server';
import POSSession from '@/models/POSSession';
import Order from '@/models/Order';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import { getBusinessContext, isManager } from '@/lib/pos-auth';

export async function POST(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isManager(ctx)) {
    return NextResponse.json({ error: 'Solo un gerente puede cerrar la caja' }, { status: 403 });
  }

  await dbConnect();
  const { closingBalance, notes } = await req.json();

  if (closingBalance === undefined) {
    return NextResponse.json({ error: 'Closing balance required' }, { status: 400 });
  }

  // Get the open session
  const posSession = await POSSession.findOne({
    businessId: ctx.businessId,
    status: 'OPEN',
  });

  if (!posSession) {
    return NextResponse.json({ error: 'No open POS session found' }, { status: 404 });
  }

  // Calculate sales since session opened
  const paidOrders = await Order.find({
    businessId: ctx.businessId,
    status: 'PAID',
    closedAt: { $gte: posSession.startedAt },
  });

  let cashSales = 0;
  let cardSales = 0;
  let transferSales = 0;

  paidOrders.forEach((order) => {
    if (order.paymentMethod === 'CASH') cashSales += order.total;
    else if (order.paymentMethod === 'CARD') cardSales += order.total;
    else if (order.paymentMethod === 'TRANSFER') transferSales += order.total;
  });

  const totalSales = cashSales + cardSales + transferSales;
  const expectedCash = posSession.openingBalance + cashSales;
  const variance = Number(closingBalance) - expectedCash;

  // Close the session
  posSession.closedAt = new Date();
  posSession.closingBalance = Number(closingBalance);
  posSession.totalSales = totalSales;
  posSession.totalOrders = paidOrders.length;
  posSession.cashSales = cashSales;
  posSession.cardSales = cardSales;
  posSession.transferSales = transferSales;
  posSession.expectedCash = expectedCash;
  posSession.actualCash = Number(closingBalance);
  posSession.variance = variance;
  posSession.status = 'CLOSED';
  if (notes) posSession.notes = notes;

  await posSession.save();

  const business = await Business.findById(ctx.businessId).select('name');

  return NextResponse.json({
    success: true,
    cut: {
      businessName: business?.name,
      sessionId: posSession._id.toString(),
      staffName: posSession.staffName,
      startTime: posSession.startedAt,
      endTime: posSession.closedAt,

      // Cash reconciliation
      openingBalance: posSession.openingBalance,
      closingBalance: posSession.closingBalance,

      // Sales breakdown
      totalSales: posSession.totalSales,
      totalOrders: posSession.totalOrders,
      cashSales: posSession.cashSales,
      cardSales: posSession.cardSales,
      transferSales: posSession.transferSales,

      // Cash cut
      expectedCash,
      actualCash: Number(closingBalance),
      variance,
      varianceNote: variance > 0 ? 'Overage' : variance < 0 ? 'Shortage' : 'Balanced',
    },
  });
}
