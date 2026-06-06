import { NextResponse } from 'next/server';
import POSSession from '@/models/POSSession';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  const { openingBalance, employeeNumber } = body;

  if (openingBalance === undefined || !employeeNumber) {
    return NextResponse.json(
      { error: 'Opening balance and employee number required' },
      { status: 400 }
    );
  }

  // For POS, we use the employee number from the request
  // Find the employee to get their business ID
  const employee = await mongoose.connection
    .collection('user')
    .findOne({ employeeNumber: employeeNumber.trim() });

  if (!employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bId = new mongoose.Types.ObjectId(employee.businessId);

  // Check if there's already an open session for this business
  const existingSession = await POSSession.findOne({
    businessId: bId,
    status: 'OPEN',
  });

  if (existingSession) {
    return NextResponse.json(
      {
        error: 'POS session already open',
        session: {
          id: existingSession._id.toString(),
          startedAt: existingSession.startedAt,
          staffName: existingSession.staffName,
        },
      },
      { status: 409 }
    );
  }

  // Create new session
  const newSession = new POSSession({
    businessId: bId,
    staffId: new mongoose.Types.ObjectId(employee._id),
    staffName: employee.name,
    openingBalance: Number(openingBalance),
    startedAt: new Date(),
    totalSales: 0,
    totalOrders: 0,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    status: 'OPEN',
    expectedCash: Number(openingBalance),
  });

  await newSession.save();

  return NextResponse.json(
    {
      success: true,
      sessionId: newSession._id.toString(),
      message: `POS session opened with $${openingBalance.toFixed(2)} opening balance`,
    },
    { status: 201 }
  );
}
