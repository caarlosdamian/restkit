import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);
  const body = await req.json();

  // Bulk update table positions
  const updates = body.updates as Array<{
    tableId: string;
    position?: { x: number; y: number };
    capacity?: number;
    section?: string;
    assignedStaffId?: string | null;
  }>;

  const results = await Promise.all(
    updates.map((u) =>
      Table.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(u.tableId), businessId: bId },
        {
          $set: {
            ...(u.position && { position: u.position }),
            ...(u.capacity != null && { capacity: u.capacity }),
            ...(u.section && { section: u.section }),
            ...(u.assignedStaffId ? { assignedStaffId: new mongoose.Types.ObjectId(u.assignedStaffId) } : u.assignedStaffId === null ? { assignedStaffId: null } : {}),
          },
        },
        { new: true }
      )
    )
  );

  return NextResponse.json({ success: true, count: results.length });
}
