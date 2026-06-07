import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Table from '@/models/Table';
import { getBusinessContext } from '@/lib/pos-auth';

// businessId is derived from the session, never from the request body.
export async function POST() {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  const tables = await Table.aggregate([
    { $match: { businessId: ctx.businessId, isActive: true } },
    { $sort: { number: 1 } },
  ]);

  return NextResponse.json({
    success: true,
    tables: tables.map((t) => ({
      _id: t._id.toString(),
      number: t.number,
      name: t.name,
      capacity: t.capacity,
      section: t.section,
      position: t.position,
      isActive: t.isActive,
    })),
  });
}
