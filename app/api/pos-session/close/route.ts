import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import POSSession from '@/models/POSSession';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  const { closingBalance, notes, employeeNumber } = body;

  if (!employeeNumber) {
    return NextResponse.json({ error: 'Employee number required' }, { status: 400 });
  }

  // Get employee to find their business
  const employee = await mongoose.connection
    .collection('user')
    .findOne({ employeeNumber: employeeNumber.trim() });

  if (!employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bId = new mongoose.Types.ObjectId(employee.businessId);

  if (closingBalance === undefined) {
    return NextResponse.json(
      { error: 'Closing balance required' },
      { status: 400 }
    );
  }

  // Get the open session
  const posSession = await POSSession.findOne({
    businessId: bId,
    status: 'OPEN',
  });

  if (!posSession) {
    return NextResponse.json(
      { error: 'No open POS session found' },
      { status: 404 }
    );
  }

  // Calculate sales since session opened
  const paidOrders = await Order.find({
    businessId: bId,
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

  return NextResponse.json({
    success: true,
    cut: {
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
