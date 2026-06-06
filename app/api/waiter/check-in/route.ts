import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  const { employeeNumber, businessId } = body;

  if (!employeeNumber || !businessId) {
    return NextResponse.json(
      { error: 'Employee number and business ID required' },
      { status: 400 }
    );
  }

  const bId = new mongoose.Types.ObjectId(businessId);

  // Find waiter by employee number (STAFF, ADMIN, or OWNER)
  const waiter = await mongoose.connection
    .collection('user')
    .findOne({
      businessId: bId,
      employeeNumber: employeeNumber.trim(),
      role: { $in: ['STAFF', 'ADMIN', 'OWNER'] },
    });

  if (!waiter) {
    return NextResponse.json(
      { error: 'Número de empleado no encontrado' },
      { status: 404 }
    );
  }

  // Return waiter session token (stored in localStorage)
  return NextResponse.json({
    success: true,
    waiterId: waiter._id.toString(),
    waiterName: waiter.name as string,
    employeeNumber: waiter.employeeNumber as string,
    role: waiter.role as string,
  });
}
