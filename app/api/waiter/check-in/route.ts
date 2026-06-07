import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';

// Identifies which waiter is acting on an already-authenticated terminal.
// businessId comes from the session, never from the request body.
// NOTE: this still resolves a waiter by employeeNumber alone. Fase 2 replaces
// this with a hashed PIN + short-lived token; treat this only as actor
// selection on top of a trusted terminal session.
export async function POST(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { employeeNumber } = await req.json();

  if (!employeeNumber) {
    return NextResponse.json({ error: 'Employee number required' }, { status: 400 });
  }

  // The Better Auth `user` collection stores businessId as a string, while
  // domain collections use ObjectId. Match both forms until Fase 4 normalizes.
  const waiter = await mongoose.connection.collection('user').findOne({
    businessId: { $in: [ctx.businessIdStr, ctx.businessId] },
    employeeNumber: employeeNumber.trim(),
    role: { $in: ['STAFF', 'ADMIN', 'OWNER'] },
  });

  if (!waiter) {
    return NextResponse.json({ error: 'Número de empleado no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    waiterId: waiter._id.toString(),
    waiterName: waiter.name as string,
    employeeNumber: waiter.employeeNumber as string,
    role: waiter.role as string,
  });
}
