import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { requireStripe, priceIdFor } from '@/lib/stripe';
import { toPlanId, toBillingPeriod } from '@/lib/plans';

/**
 * Starts a Stripe Checkout session (mode: subscription) for the caller's
 * business and returns the hosted-checkout URL. OWNER only — the owner manages
 * billing. Reuses the business's Stripe customer across upgrades.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = toPlanId(body.plan);
  const period = toBillingPeriod(body.period);
  if (!plan) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
  }

  const priceId = priceIdFor(plan, period);
  if (!priceId) {
    return NextResponse.json(
      { error: `Precio no configurado para ${plan}/${period}. Falta la variable STRIPE_PRICE_*.` },
      { status: 500 }
    );
  }

  await dbConnect();
  const business = await Business.findById(
    new mongoose.Types.ObjectId(session.user.businessId)
  );
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

  const stripe = requireStripe();

  // Reuse or create the Stripe customer for this business.
  let customerId = business.subscription?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: business.name,
      metadata: { businessId: business._id.toString() },
    });
    customerId = customer.id;
    business.subscription = { ...business.subscription, stripeCustomerId: customerId };
    await business.save();
  }

  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // businessId travels on the subscription so the webhook can find the tenant
    // even if it fires before we read the checkout.session object.
    subscription_data: { metadata: { businessId: business._id.toString(), plan, period } },
    metadata: { businessId: business._id.toString(), plan, period },
    success_url: `${appUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${appUrl}/dashboard/billing?checkout=cancel`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkout.url });
}
