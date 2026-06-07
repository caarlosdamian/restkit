import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { hashPin } from '@/lib/waiter-token';

// Set or reset a staff member's POS PIN (OWNER only).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { staffId } = await params;
  const { pin } = await req.json();

  if (!pin || !/^\d{4,6}$/.test(String(pin))) {
    return NextResponse.json({ error: 'El PIN debe tener entre 4 y 6 dígitos' }, { status: 400 });
  }

  await dbConnect();

  const result = await mongoose.connection.collection('user').updateOne(
    {
      _id: new mongoose.Types.ObjectId(staffId),
      businessId: session.user.businessId,
    },
    { $set: { pinHash: hashPin(String(pin)), updatedAt: new Date() } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { staffId } = await params;

  // Prevent owners from deleting themselves
  if (staffId === session.user.id) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
  }

  await dbConnect();

  // Verify the target user belongs to the same business
  const target = await mongoose.connection.collection('user').findOne({
    _id: new mongoose.Types.ObjectId(staffId),
    businessId: session.user.businessId,
  });

  if (!target) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  // Delete user + their sessions + their accounts
  await Promise.all([
    mongoose.connection.collection('user').deleteOne({ _id: target._id }),
    mongoose.connection.collection('session').deleteMany({ userId: target._id.toString() }),
    mongoose.connection.collection('account').deleteMany({ userId: target._id.toString() }),
  ]);

  return NextResponse.json({ success: true });
}
