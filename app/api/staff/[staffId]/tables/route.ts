import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Table from '@/models/Table';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

type Params = Promise<{ staffId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { staffId } = await params;
  const bId = new mongoose.Types.ObjectId(session.user.businessId);
  const sId = new mongoose.Types.ObjectId(staffId);

  // Find tables assigned to this staff
  const tables = await Table.aggregate([
    { $match: { businessId: bId, isActive: true, assignedStaffId: sId } },
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
