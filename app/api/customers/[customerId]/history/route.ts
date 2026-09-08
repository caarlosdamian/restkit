import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { loyaltyService } from '@/services/loyalty.service';

type Params = Promise<{ customerId: string }>;

/** The history is internal. The cardholder never sees it — their pass and the
 *  public card page show only the current number. */
async function requireManager() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return null;
  if (!['OWNER', 'ADMIN'].includes(session.user.role)) return null;
  return session;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const session = await requireManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customerId } = await params;
  const page = Math.max(0, Number(new URL(req.url).searchParams.get('page') ?? 0));

  const history = await loyaltyService.history(customerId, session.user.businessId, page, 10);
  return NextResponse.json(history);
}

/** Remove a purchase: writes a compensating entry, never deletes the original. */
export async function POST(req: Request, { params }: { params: Params }) {
  const session = await requireManager();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customerId } = await params;
  const body = await req.json();
  if (!body.visitId) {
    return NextResponse.json({ error: 'Falta el movimiento a revertir' }, { status: 400 });
  }

  try {
    await loyaltyService.reverse({
      visitId: String(body.visitId),
      businessId: session.user.businessId,
      employeeId: session.user.id,
    });
    const history = await loyaltyService.history(customerId, session.user.businessId, 0, 10);
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo revertir' },
      { status: 400 }
    );
  }
}
