import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const business = await Business.findById(session.user.businessId);
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(business);
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();

  const business = await Business.findByIdAndUpdate(
    session.user.businessId,
    { $set: body },
    { new: true, runValidators: true }
  );

  return NextResponse.json(business);
}
