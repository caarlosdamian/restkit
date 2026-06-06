import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import Table from '@/models/Table';

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  const { businessId } = body;

  if (!businessId) {
    return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
  }

  const bId = new mongoose.Types.ObjectId(businessId);

  // Get all active tables for this business
  const tables = await Table.aggregate([
    { $match: { businessId: bId, isActive: true } },
    { $sort: { number: 1 } },
  ]);

  return NextResponse.json({
    success: true,
    tables: tables.map((t) => ({
      id: t._id.toString(),
      number: t.number,
      name: t.name,
      capacity: t.capacity,
      section: t.section,
      position: t.position,
      isActive: t.isActive,
    })),
  });
}
