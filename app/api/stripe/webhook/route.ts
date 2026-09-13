import { NextResponse } from 'next/server';
import { requireStripe } from '@/lib/stripe';
import { billingService } from '@/services/billing.service';

/**
 * Stripe webhook. Unauthenticated by design, but every request is
 * signature-verified against STRIPE_WEBHOOK_SECRET using the RAW body — so
 * only Stripe can drive subscription state. Never trusts a parsed/forwarded
 * body.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // 500 rather than 200 on purpose: Stripe retries a 5xx for ~3 days, so
    // events that arrive while this is misconfigured are not lost — they land
    // once the variable is set AND the project is redeployed. ⚠️ On Vercel an
    // env var binds at build time, so setting it in the dashboard alone changes
    // nothing here.
    console.error(
      '[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set — every event is being rejected. ' +
        'Set it and REDEPLOY; changing it in the dashboard alone does nothing.'
    );
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET no está configurado en este deployment.' },
      { status: 500 }
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Falta la firma de Stripe' }, { status: 400 });
  }

  // Raw body is required for signature verification — do not JSON.parse first.
  const payload = await req.text();

  let event;
  try {
    event = requireStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Firma inválida: ${err instanceof Error ? err.message : 'desconocido'}` },
      { status: 400 }
    );
  }

  try {
    await billingService.applyStripeEvent(event);
  } catch (err) {
    // 500 tells Stripe to retry later.
    //
    // The reason goes in the BODY as well as the log: Stripe's dashboard shows
    // the response for every failed attempt, and that is where anyone debugging
    // this actually looks first. Safe to be specific — a request only reaches
    // here after passing signature verification, so it genuinely came from
    // Stripe.
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`Stripe webhook handling failed (${event.type}, ${event.id})`, err);
    return NextResponse.json(
      { error: `Error procesando ${event.type}: ${reason}`, eventId: event.id },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
