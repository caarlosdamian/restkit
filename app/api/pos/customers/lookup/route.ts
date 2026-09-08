import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Customer, { newPublicToken } from '@/models/Customer';
import Business from '@/models/Business';
import { getBusinessContext } from '@/lib/pos-auth';
import { summariseCustomer } from '@/lib/customer-summary';
import { randomBytes } from 'crypto';

/** Phone digits only — the cashier types whatever's fastest. */
function digits(s: string): string {
  return String(s).replace(/\D/g, '');
}

async function summarise(
  customer: InstanceType<typeof Customer>,
  businessId: string,
  orderTotal: number
) {
  // Bound to a variable first: inlining the await into the call argument makes
  // TypeScript pick the wrong Mongoose `findById` overload.
  const business = await Business.findById(businessId);
  return summariseCustomer(customer, business, orderTotal);
}

/** Search by phone. Four digits is enough to narrow a single business. */
export async function GET(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = digits(url.searchParams.get('phone') ?? '');
  const orderTotal = Number(url.searchParams.get('total') ?? 0);
  if (q.length < 4) return NextResponse.json({ results: [] });

  await dbConnect();
  const matches = await Customer.find({
    businessId: ctx.businessId,
    phone: { $regex: q, $options: 'i' },
  })
    .limit(5)
    .sort({ updatedAt: -1 });

  const results = await Promise.all(
    matches.map((c) => summarise(c, ctx.businessIdStr, orderTotal))
  );
  return NextResponse.json({ results });
}

/** Enrol a walk-in at the register. Phone is the only thing we ask for; a
 *  name can be filled in later from the dashboard. */
export async function POST(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const phone = digits(body.phone ?? '');
  if (phone.length < 10) {
    return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
  }

  await dbConnect();

  const existing = await Customer.findOne({ businessId: ctx.businessId, phone });
  if (existing) {
    return NextResponse.json(
      await summarise(existing, ctx.businessIdStr, Number(body.total ?? 0))
    );
  }

  try {
    const customer = await Customer.create({
      name: String(body.name ?? '').trim() || `Cliente ${phone.slice(-4)}`,
      phone,
      businessId: new mongoose.Types.ObjectId(ctx.businessIdStr),
      stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
      publicToken: newPublicToken(),
      externalIds: { appleAuthToken: randomBytes(20).toString('hex') },
    });
    return NextResponse.json(
      await summarise(customer, ctx.businessIdStr, Number(body.total ?? 0)),
      { status: 201 }
    );
  } catch (err) {
    // Two terminals enrolling the same walk-in at once — return the winner.
    if ((err as { code?: number }).code === 11000) {
      const winner = await Customer.findOne({ businessId: ctx.businessId, phone });
      if (winner) {
        return NextResponse.json(
          await summarise(winner, ctx.businessIdStr, Number(body.total ?? 0))
        );
      }
    }
    console.error('Customer enrolment failed:', err);
    return NextResponse.json({ error: 'No se pudo crear el cliente' }, { status: 500 });
  }
}
