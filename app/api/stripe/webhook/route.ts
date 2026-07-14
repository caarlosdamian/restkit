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
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
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
    console.error('Stripe webhook handling failed', event.type, err);
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
