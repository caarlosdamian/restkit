import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import InventoryMovement from '@/models/InventoryMovement';
import { inventoryService } from '@/services/inventory.service';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

type Params = Promise<{ itemId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { itemId } = await params;
  const businessId = new mongoose.Types.ObjectId(session.user.businessId);

  const movements = await InventoryMovement.find({
    businessId,
    inventoryItemId: new mongoose.Types.ObjectId(itemId),
  })
    .sort({ createdAt: -1 })
    .limit(50);

  return NextResponse.json(movements);
}

// Manual stock change: restock, waste, or a free-form correction. Sale
// deductions are written internally by inventoryService.deductForOrder, not
// through this endpoint.
export async function POST(req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { itemId } = await params;
  const { type, delta, note } = await req.json();

  if (!['RESTOCK', 'WASTE', 'ADJUSTMENT'].includes(type) || typeof delta !== 'number' || delta === 0) {
    return NextResponse.json({ error: 'type y delta (distinto de 0) son requeridos' }, { status: 400 });
  }

  // RESTOCK/WASTE are directional regardless of the sign the client sends;
  // ADJUSTMENT is a free-form correction and keeps the sign as given.
  const signedDelta = type === 'RESTOCK' ? Math.abs(delta) : type === 'WASTE' ? -Math.abs(delta) : delta;

  try {
    const businessId = new mongoose.Types.ObjectId(session.user.businessId);
    const item = await inventoryService.adjustStock(
      businessId,
      new mongoose.Types.ObjectId(itemId),
      type,
      signedDelta,
      { note, staffId: new mongoose.Types.ObjectId(session.user.id) }
    );
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al ajustar inventario' },
      { status: 404 }
    );
  }
}
