import type Stripe from 'stripe';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import { stripe } from '@/lib/stripe';
import type { SubscriptionStatus, PlanId, BillingPeriod } from '@/models/Business';

/** Map a Stripe subscription status to our coarser access states. */
function mapStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'canceled':
      return 'canceled';
    default:
      // past_due, unpaid, incomplete, incomplete_expired, paused → treat as
      // needing payment.
      return 'past_due';
  }
}

/** current_period_end moved onto subscription items in newer Stripe API
 *  versions; read whichever is present. */
function periodEnd(sub: Stripe.Subscription): Date | undefined {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const unix = top ?? item?.current_period_end;
  return unix ? new Date(unix * 1000) : undefined;
}

async function findBusinessId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.businessId;
  if (fromMeta) return fromMeta;
  // Fall back to the customer id we stored at checkout.
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const biz = await Business.findOne({ 'subscription.stripeCustomerId': customerId }).select('_id');
  return biz ? biz._id.toString() : null;
}

async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const businessId = await findBusinessId(sub);
  if (!businessId) return; // unknown tenant — nothing to update

  const business = await Business.findById(businessId);
  if (!business) return;

  const plan = sub.metadata?.plan as PlanId | undefined;
  const period = sub.metadata?.period as BillingPeriod | undefined;

  business.subscription = {
    ...business.subscription,
    status: mapStatus(sub.status),
    stripeSubscriptionId: sub.id,
    stripeCustomerId:
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? business.subscription?.stripeCustomerId,
    currentPeriodEnd: periodEnd(sub),
    ...(plan ? { plan } : {}),
    ...(period ? { billingPeriod: period } : {}),
  };
  await business.save();
}

export const billingService = {
  /**
   * Apply a verified Stripe event to the matching Business. Idempotent —
   * re-delivering the same event just re-writes the same state. Only the
   * subscription-lifecycle events change access; everything else is ignored.
   */
  async applyStripeEvent(event: Stripe.Event): Promise<void> {
    await dbConnect();

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        // Ignored (checkout.session.completed etc. — the subscription.* events
        // carry everything we need).
        break;
    }
  },

  /**
   * Pull the customer's latest subscription straight from Stripe and apply it.
   * A fallback for when the webhook is delayed or never arrives (e.g. local dev
   * without `stripe listen`, or a missed delivery) — the billing page calls
   * this on return from checkout so a just-purchased plan reflects immediately
   * instead of appearing stuck in "trialing". No-op if Stripe isn't configured
   * or the customer has no subscription.
   */
  async syncSubscriptionFromStripe(customerId: string): Promise<void> {
    if (!stripe) return;
    await dbConnect();
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });
    const sub = subs.data[0];
    if (sub) await applySubscription(sub);
  },
};
