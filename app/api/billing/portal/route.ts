import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { requireStripe } from '@/lib/stripe';

/**
 * Opens the Stripe Billing Portal so the owner can update payment methods,
 * change plan, or cancel. OWNER only. Returns the portal URL to redirect to.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const business = await Business.findById(
    new mongoose.Types.ObjectId(session.user.businessId)
  ).select('subscription name');

  const customerId = business?.subscription?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: 'Aún no tienes una suscripción. Elige un plan primero.' },
      { status: 400 }
    );
  }

  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const portal = await requireStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
