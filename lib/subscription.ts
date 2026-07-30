import type { ISubscription } from '@/models/Business';
import { planAllows, type FeatureId } from '@/lib/plans';

/**
 * Pure evaluation of a business's subscription into an access decision. No DB,
 * no Stripe — safe to import anywhere (server components, API routes, tests).
 *
 * Gating philosophy is deliberately conservative so nobody gets wrongly locked
 * out: a business is blocked ONLY when we affirmatively know it's expired.
 *  - Missing subscription / missing status (legacy & seed docs) → grandfathered,
 *    never gated.
 *  - trialing → access until trialEndsAt; blocked once it passes (trial-without-
 *    card, so trial expiry is time-based, not a Stripe webhook).
 *  - active → access (a missed renewal flips to past_due via webhook).
 *  - past_due / canceled → blocked, unless still inside a paid currentPeriodEnd
 *    (e.g. cancel-at-period-end keeps access until the period actually ends).
 */
export interface SubscriptionView {
  /** Has access to the product right now. */
  active: boolean;
  /** Currently in the free trial window. */
  trialing: boolean;
  /** Whole days left in the trial (0 if not trialing or already expired). */
  trialDaysLeft: number;
  /** The gate should send them to /dashboard/billing. */
  needsUpgrade: boolean;
  /**
   * They have a real Stripe subscription backing their access (they PURCHASED a
   * plan), as opposed to the bare free app-trial. True even while `trialing`,
   * because Stripe can put a paid plan in a trial period. The signal is a
   * `stripeSubscriptionId` (a `stripeCustomerId` alone is not — that's created
   * just by opening checkout). Drives whether the UI nudges them to buy.
   */
  subscribed: boolean;
  status: ISubscription['status'] | 'none';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Coerce a date field to a Date. Mongoose full documents give us a Date, but
 * the same subscription read via `.lean()`, serialized to a client component,
 * or round-tripped through JSON arrives as an ISO string (or epoch ms). Handle
 * all three so the gate never throws on real data.
 */
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export function evaluateSubscription(
  sub: ISubscription | null | undefined,
  now: Date = new Date()
): SubscriptionView {
  // Legacy / seed businesses with no subscription data are grandfathered in.
  if (!sub || !sub.status) {
    return {
      active: true,
      trialing: false,
      trialDaysLeft: 0,
      needsUpgrade: false,
      subscribed: false,
      status: 'none',
    };
  }

  const trialEndsAt = toDate(sub.trialEndsAt);
  const currentPeriodEnd = toDate(sub.currentPeriodEnd);
  const periodValid = currentPeriodEnd ? currentPeriodEnd.getTime() > now.getTime() : false;
  // A Stripe SUBSCRIPTION id means they committed to a paid plan (even if it's
  // currently in a Stripe trial). status 'active' implies it too. A customer id
  // alone is NOT enough — Stripe creates one the moment checkout is opened,
  // even if it's abandoned; treating that as "purchased" would hide the trial
  // banner and tier-gate a free-trial business to the plan they merely clicked.
  const subscribed = !!sub.stripeSubscriptionId || sub.status === 'active';

  if (sub.status === 'trialing') {
    const trialValid = trialEndsAt ? trialEndsAt.getTime() > now.getTime() : false;
    const trialDaysLeft = trialValid
      ? Math.ceil((trialEndsAt!.getTime() - now.getTime()) / DAY_MS)
      : 0;
    return {
      active: trialValid,
      trialing: trialValid,
      trialDaysLeft,
      needsUpgrade: !trialValid,
      subscribed,
      status: 'trialing',
    };
  }

  if (sub.status === 'active') {
    return {
      active: true,
      trialing: false,
      trialDaysLeft: 0,
      needsUpgrade: false,
      subscribed: true,
      status: 'active',
    };
  }

  // past_due / canceled: blocked, unless still within a paid period.
  return {
    active: periodValid,
    trialing: false,
    trialDaysLeft: 0,
    needsUpgrade: !periodValid,
    subscribed,
    status: sub.status,
  };
}

/**
 * Tier gate: does this business's subscription include a feature?
 * Layered on top of the access gate (`needsUpgrade`), which still wins — this
 * only differentiates WHAT an in-good-standing business can use.
 *
 * Semantics (same conservative philosophy as above):
 *  - Grandfathered (no subscription data) → everything. Legacy/seed docs are
 *    never feature-gated.
 *  - Free trial, no purchased plan → everything. The trial shows off the full
 *    product; tier limits only bite once they're actually paying.
 *  - Purchased → their plan's tier (basic loses pro-only features). Missing
 *    plan on a purchased sub → allow, never wrongly lock out.
 */
export function featureAllowed(
  sub: ISubscription | null | undefined,
  feature: FeatureId,
  now: Date = new Date()
): boolean {
  const view = evaluateSubscription(sub, now);
  if (view.status === 'none') return true; // grandfathered
  if (!view.subscribed) return true; // free trial — full access (expiry is needsUpgrade's job)
  const plan = sub?.plan;
  if (!plan) return true;
  return planAllows(plan, feature);
}
