import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';
import { verifyPinHash, signWaiterToken } from '@/lib/waiter-token';

// Best-effort brute-force throttle. Per server instance only — for multi-node
// deployments move this to a shared store (Redis) or a per-user lockout field.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

export async function POST(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pin } = await req.json();
  if (!pin || typeof pin !== 'string') {
    return NextResponse.json({ error: 'PIN requerido' }, { status: 400 });
  }

  // Throttle by business (terminal is already authenticated, so this is the
  // relevant scope to limit guessing across the staff list).
  const key = ctx.businessIdStr;
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.until > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento.' },
      { status: 429 }
    );
  }

  await dbConnect();

  // Candidate waiters in this business that have a PIN configured.
  // user.businessId is stored as a string by Better Auth; match both forms.
  const candidates = await mongoose.connection
    .collection('user')
    .find({
      businessId: { $in: [ctx.businessIdStr, ctx.businessId] },
      role: { $in: ['STAFF', 'ADMIN', 'OWNER'] },
      pinHash: { $exists: true, $ne: null },
    })
    .toArray();

  const match = candidates.find((u) => verifyPinHash(pin, u.pinHash as string));

  if (!match) {
    const next = record && record.until > now ? record : { count: 0, until: now + LOCKOUT_MS };
    next.count += 1;
    attempts.set(key, next);
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
  }

  attempts.delete(key);

  const staffId = match._id.toString();
  const staffName = (match.name as string) ?? 'Mesero';
  const token = signWaiterToken(staffId, staffName, ctx.businessIdStr);

  return NextResponse.json({ staffId, staffName, token });
}
