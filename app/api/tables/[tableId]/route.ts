import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

type Params = Promise<{ tableId: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get('businessId');

  if (!businessId) {
    return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
  }

  await dbConnect();
  const { tableId } = await params;

  const table = await Table.findOne({
    _id: new mongoose.Types.ObjectId(tableId),
    businessId: new mongoose.Types.ObjectId(businessId),
  });

  if (!table) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
  return NextResponse.json(table);
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { tableId } = await params;
  const body = await req.json();

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  try {
    const table = await Table.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(tableId), businessId },
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!table) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    return NextResponse.json(table);
  } catch (err) {
    // Unique index on {businessId, number}.
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { error: `Ya existe una mesa con el número ${body.number}` },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { tableId } = await params;

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  await Table.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(tableId), businessId },
    { $set: { isActive: false } }
  );

  return NextResponse.json({ success: true });
}
