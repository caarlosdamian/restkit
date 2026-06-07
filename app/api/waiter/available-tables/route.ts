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
          { $project: { status: 1, total: 1, itemCount: { $size: '$items' } } },
        ],
        as: 'activeOrder',
      },
    },
    { $addFields: { activeOrder: { $arrayElemAt: ['$activeOrder', 0] } } },
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
      isOccupied: t.isOccupied ?? false,
      activeOrder: t.activeOrder
        ? {
            _id: t.activeOrder._id.toString(),
            status: t.activeOrder.status,
            total: t.activeOrder.total,
            itemCount: t.activeOrder.itemCount,
          }
        : null,
    })),
  });
}
