import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import POSSession from '@/models/POSSession';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const employeeNumber = url.searchParams.get('employeeNumber');
  console.log('posSession',employeeNumber)

  if (!employeeNumber) {
    return NextResponse.json({ error: 'Employee number required' }, { status: 400 });
  }

  await dbConnect();

  // Get employee to find their business
  const employee = await mongoose.connection
    .collection('user')
    .findOne({ employeeNumber: employeeNumber.trim() });

  if (!employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bId = new mongoose.Types.ObjectId(employee.businessId);

  // Get the current open session
  const posSession = await POSSession.findOne({
    businessId: bId,
    status: 'OPEN',
  });

  if (!posSession) {
    return NextResponse.json({ session: null });
  }

  // Calculate current sales from paid orders since session started
  const paidOrders = await Order.find({
    businessId: bId,
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
