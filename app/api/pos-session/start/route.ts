import { NextResponse } from 'next/server';
import POSSession from '@/models/POSSession';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext, isManager } from '@/lib/pos-auth';
import { evaluateSubscription } from '@/lib/subscription';

export async function POST(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isManager(ctx)) {
    return NextResponse.json({ error: 'Solo un gerente puede abrir la caja' }, { status: 403 });
  }

  await dbConnect();

  // Selling requires an active subscription. Opening the register is the money
  // gate for the POS — an expired trial can't start a shift.
  const business = await Business.findById(ctx.businessId).select('subscription');
  if (evaluateSubscription(business?.subscription).needsUpgrade) {
    return NextResponse.json(
      { error: 'Tu suscripción expiró. Reactívala para abrir la caja.', code: 'SUBSCRIPTION_REQUIRED' },
      { status: 402 }
    );
  }

  const { openingBalance } = await req.json();

  if (openingBalance === undefined) {
    return NextResponse.json({ error: 'Opening balance required' }, { status: 400 });
  }

  // Check if there's already an open session for this business
  const existingSession = await POSSession.findOne({
    businessId: ctx.businessId,
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

  const newSession = new POSSession({
    businessId: ctx.businessId,
    staffId: new mongoose.Types.ObjectId(ctx.userId),
    staffName: ctx.userName,
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
      message: `POS session opened with $${Number(openingBalance).toFixed(2)} opening balance`,
    },
    { status: 201 }
  );
}
