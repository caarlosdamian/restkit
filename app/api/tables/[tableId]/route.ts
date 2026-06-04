import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';

type Params = Promise<{ tableId: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { tableId } = await params;
  const body = await req.json();

  const table = await Table.findOneAndUpdate(
    { _id: tableId, businessId: session.user.businessId },
    { $set: body },
    { new: true }
  );

  if (!table) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
  return NextResponse.json(table);
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { tableId } = await params;

  await Table.findOneAndUpdate(
    { _id: tableId, businessId: session.user.businessId },
    { $set: { isActive: false } }
  );

  return NextResponse.json({ success: true });
}
