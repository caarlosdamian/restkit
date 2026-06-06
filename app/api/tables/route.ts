import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Table from '@/models/Table';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);

  // Fetch tables with their active order in one aggregation
  const tables = await Table.aggregate([
    { $match: { businessId: bId, isActive: true } },
    { $sort: { number: 1 } },
    {
      $lookup: {
        from: 'orders',
        let: { tableId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$tableId', '$$tableId'] },
              status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ],
        as: 'activeOrder',
      },
    },
    { $addFields: { activeOrder: { $arrayElemAt: ['$activeOrder', 0] } } },
  ]);

  return NextResponse.json(tables);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { number, name, capacity } = await req.json();

  if (!number) return NextResponse.json({ error: 'El número de mesa es requerido' }, { status: 400 });

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  const table = await Table.create({
    number,
    name: name || `Mesa ${number}`,
    capacity: capacity || 4,
    businessId,
  });

  return NextResponse.json(table, { status: 201 });
}
