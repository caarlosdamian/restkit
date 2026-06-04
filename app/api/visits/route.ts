import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { visitService } from '@/services/visit.service';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = await req.json();
    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const result = await visitService.recordVisit(
      customerId,
      session.user.businessId,
      session.user.id
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Visit error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
