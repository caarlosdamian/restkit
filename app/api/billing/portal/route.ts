import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { requireStripe } from '@/lib/stripe';
import { appUrl } from '@/lib/app-url';

/**
 * Opens the Stripe Billing Portal so the owner can update payment methods,
 * change plan, or cancel. OWNER only. Returns the portal URL to redirect to.
 */
export async function POST() {
  try {
    return await portal();
  } catch (err) {
    // Same rule as checkout: an empty body reaches the browser as a JSON
    // parser error and hides whatever actually went wrong.
    console.error('Billing portal failed:', err);
    return NextResponse.json(
      {
        error: `No se pudo abrir el portal: ${err instanceof Error ? err.message : 'error desconocido'}`,
        code: 'PORTAL_FAILED',
      },
      { status: 500 }
    );
  }
}

async function portal() {
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

  const base = appUrl();
  const portal = await requireStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/dashboard/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
