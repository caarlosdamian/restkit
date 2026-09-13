import mongoose from 'mongoose';
import type Stripe from 'stripe';
import Business from '@/models/Business';
import dbConnect from '@/lib/db';
import { stripe, planForPriceId } from '@/lib/stripe';
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

/**
 * Work out which business a subscription belongs to.
 *
 * Four ways, cheapest first, because a subscription can be created in more
 * places than Checkout and each one knows less than the last:
 *
 *  1. `sub.metadata.businessId` — what our own checkout sets.
 *  2. The customer id we stored when they opened checkout.
 *  3. `customer.metadata.businessId` — also ours, and it survives even if the
 *     stored id was never written because they abandoned the redirect.
 *  4. The customer's EMAIL, matched against the account. ⚠️ This is the one
 *     that makes a subscription created entirely in the Stripe dashboard work:
 *     without it, a customer we have never seen resolves to nothing and the
 *     event is dropped in silence, so the only way to sell a plan off-line was
 *     to first make the owner click a plan just to mint a customer record.
 *
 * Returning null is the safe answer — the caller leaves everything alone — so
 * every lookup here is allowed to fail quietly rather than fail the webhook.
 */
async function findBusinessId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.businessId;
  if (fromMeta) {
    // ⚠️ Metadata is typed by whoever created the subscription — a person in
    // the Stripe dashboard, usually. Handing a non-ObjectId straight to
    // `findById` throws a CastError, which becomes a 500, which Stripe retries
    // for three days while every other event queues behind it. A value that
    // cannot be an id is an unknown tenant, not an outage.
    if (mongoose.Types.ObjectId.isValid(fromMeta)) return fromMeta;
    console.error(
      `[billing] subscription ${sub.id} carries businessId="${fromMeta}", which is not a valid id. ` +
        'Falling back to the customer.'
    );
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  const stored = await Business.findOne({ 'subscription.stripeCustomerId': customerId }).select('_id');
  if (stored) return stored._id.toString();

  // Everything below needs the customer object, which the event carries only as
  // an id. A Stripe outage here must not fail the event: it would be retried
  // for days against a lookup that was never going to be the answer.
  if (!stripe) return null;
  const customer = await stripe.customers.retrieve(customerId).catch(() => null);
  if (!customer || customer.deleted) return null;

  const metaId = customer.metadata?.businessId;
  if (metaId) return metaId;

  const email = customer.email?.trim().toLowerCase();
  if (!email) return null;
  // `user.email` is unique, so this cannot match two tenants. `businessId` is a
  // string in the better-auth collection — see the type note in CLAUDE.md.
  const owner = await mongoose.connection
    .collection('user')
    .findOne({ email }, { projection: { businessId: 1 } });
  return owner?.businessId ? String(owner.businessId) : null;
}

async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const businessId = await findBusinessId(sub);
  if (!businessId) return; // unknown tenant — nothing to update

  const business = await Business.findById(businessId);
  if (!business) return;

  /**
   * Metadata first — it is explicit, and `POST /api/billing/checkout` always
   * sets it. Failing that, work the tier out from the PRICE, which every
   * subscription carries whether or not anyone thought about metadata.
   *
   * ⚠️ Without this fallback a subscription created in the Stripe dashboard
   * granted access but left the plan untouched, so a business sold Lite kept
   * running as whatever signup defaulted to (`pro`) — paying for one tier and
   * using another, with nothing anywhere reporting it.
   *
   * An unrecognised price (a one-off, or a grandfathered deal) resolves to
   * nothing and the plan is left exactly as it was, which is the right answer
   * when we genuinely cannot tell.
   */
  const fromPrice = planForPriceId(sub.items?.data?.[0]?.price?.id);
  const plan = (sub.metadata?.plan as PlanId | undefined) ?? fromPrice?.plan;
  const period = (sub.metadata?.period as BillingPeriod | undefined) ?? fromPrice?.period;

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
