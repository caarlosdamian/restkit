import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

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
