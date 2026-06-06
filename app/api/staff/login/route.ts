import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const { employeeNumber } = body;

  if (!employeeNumber) {
    return NextResponse.json({ error: 'Employee number required' }, { status: 400 });
  }

  const bId = new mongoose.Types.ObjectId(session.user.businessId);

  // Find staff member by employee number
  const staff = await mongoose.connection
    .collection('user')
    .findOne({
      businessId: bId,
      employeeNumber: employeeNumber.trim(),
      role: 'STAFF',
    });

  if (!staff) {
    return NextResponse.json({ error: 'Número de empleado no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    staffId: staff._id.toString(),
    staffName: staff.name as string,
  });
}
