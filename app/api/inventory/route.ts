import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import InventoryItem from '@/models/InventoryItem';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  const items = await InventoryItem.find({ businessId, isActive: true }).sort({
    category: 1,
    name: 1,
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { name, unit, quantity, lowStockThreshold, category, notes } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
  }

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  const item = await InventoryItem.create({
    businessId,
    name,
    unit: unit || 'unidad',
    quantity: quantity != null ? Number(quantity) : 0,
    lowStockThreshold: lowStockThreshold != null ? Number(lowStockThreshold) : 0,
    category: category || 'General',
    notes,
  });

  return NextResponse.json(item, { status: 201 });
}
