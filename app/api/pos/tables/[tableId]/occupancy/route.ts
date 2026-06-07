import { NextResponse } from 'next/server';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';

type Params = Promise<{ tableId: string }>;

// Toggle a table's manual occupancy from the POS terminal. Only touches the
// `isOccupied` flag — never the rest of the table document.
export async function PATCH(req: Request, { params }: { params: Params }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { tableId } = await params;
  const { isOccupied } = await req.json();

  if (typeof isOccupied !== 'boolean') {
    return NextResponse.json({ error: 'isOccupied (boolean) requerido' }, { status: 400 });
  }

  const table = await Table.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(tableId), businessId: ctx.businessId },
    { $set: { isOccupied } },
    { new: true }
  );

  if (!table) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });

  return NextResponse.json({ _id: table._id.toString(), isOccupied: table.isOccupied });
}
