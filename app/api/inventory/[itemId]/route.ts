import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import InventoryItem from '@/models/InventoryItem';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

type Params = Promise<{ itemId: string }>;

// Editable fields only — quantity changes go through /movements so every
// stock change is logged with a reason, never edited silently.
const EDITABLE_FIELDS = ['name', 'unit', 'lowStockThreshold', 'category', 'notes'] as const;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { itemId } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  const item = await InventoryItem.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(itemId), businessId },
    { $set: update },
    { new: true }
  );

  if (!item) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { itemId } = await params;

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  await InventoryItem.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(itemId), businessId },
    { $set: { isActive: false } }
  );

  return NextResponse.json({ success: true });
}
