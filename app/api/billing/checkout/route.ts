import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { requireStripe, requirePriceId, StripePriceMisconfiguredError } from '@/lib/stripe';
import { toPlanId, toBillingPeriod } from '@/lib/plans';
import { appUrl } from '@/lib/app-url';

/**
 * Starts a Stripe Checkout session (mode: subscription) for the caller's
 * business and returns the hosted-checkout URL. OWNER only — the owner manages
 * billing. Reuses the business's Stripe customer across upgrades.
 */
export async function POST(req: Request) {
  try {
    return await checkout(req);
  } catch (err) {
    console.error('Checkout failed:', err);
    return NextResponse.json(
      {
        error: `No se pudo iniciar el pago: ${err instanceof Error ? err.message : 'error desconocido'}`,
        code: 'CHECKOUT_FAILED',
      },
      { status: 500 }
    );
  }
}

/**
 * ⚠️ **A route handler must never answer with an empty body.** An uncaught
 * throw here returns a body-less 500, and the browser's `res.json()` then
 * fails with "Unexpected end of JSON input" — the owner sees a JSON parser
 * error instead of the actual problem, and so do we. Several things in this
 * handler can throw: `requireStripe()` when STRIPE_SECRET_KEY is unset, the
 * Stripe SDK on a bad key or a network blip, `dbConnect`, and a businessId
 * that is not a valid ObjectId.
 *
 * The message is passed through because this endpoint is OWNER-only and the
 * owner is the person who has to fix the configuration.
 */
async function checkout(req: Request) {
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

  let priceId: string;
  try {
    priceId = requirePriceId(plan, period);
  } catch (err) {
    if (err instanceof StripePriceMisconfiguredError) {
      // 500 because the deployment is wrong, not the request. The message names
      // the variable so this is fixable without reading a server log.
      console.error('Stripe price misconfigured:', err.message);
      return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
    }
    throw err;
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

  const base = appUrl();

  let checkout;
  try {
    checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // businessId travels on the subscription so the webhook can find the tenant
      // even if it fires before we read the checkout.session object.
      subscription_data: { metadata: { businessId: business._id.toString(), plan, period } },
      metadata: { businessId: business._id.toString(), plan, period },
      success_url: `${base}/dashboard/billing?checkout=success`,
      cancel_url: `${base}/dashboard/billing?checkout=cancel`,
      allow_promotion_codes: true,
    });
  } catch (err) {
    // ⚠️ A price id carries no hint of which MODE it belongs to, so a live price
    // under a test key (or the reverse) looks perfectly well-formed and only
    // fails here, as `resource_missing`. It is the last way this can be
    // misconfigured, and the generic 500 it used to raise told the owner
    // nothing at the exact moment they were trying to pay.
    const stripeErr = err as { code?: string; type?: string };
    if (stripeErr?.code === 'resource_missing') {
      const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
      const keyMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';
      console.error(`Stripe rejected ${priceId} from ${envKey} (key is ${keyMode} mode):`, err);
      return NextResponse.json(
        {
          error: `Stripe no encuentra el precio ${priceId}. Tu clave es de modo ${keyMode}, así que ${envKey} tiene que ser un precio del mismo modo y de la misma cuenta.`,
          code: 'STRIPE_PRICE_NOT_FOUND',
        },
        { status: 500 }
      );
    }
    throw err;
  }

  return NextResponse.json({ url: checkout.url });
}
