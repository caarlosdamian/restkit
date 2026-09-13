import type { BillingPeriod, PlanId } from './plans';

/**
 * The metadata a Stripe subscription must carry for RestKit to understand it.
 *
 * ⚠️ `billingService` reads the tenant and the tier from HERE, never from the
 * price id — there is no way to get from a `price_…` back to a plan without a
 * lookup table, and the metadata is what the webhook already receives. The
 * consequence is easy to miss: a subscription created without these keys still
 * grants access (the customer id is enough to find the business) but leaves
 * `Business.subscription.plan` at whatever it was. Sell someone Lite that way
 * and they keep running as Profesional while paying for Lite.
 *
 * So both writers go through this function: `POST /api/billing/checkout` for a
 * normal purchase, and `scripts/grant-subscription.mts` for one sold off-line.
 */
export interface SubscriptionMetadata {
  businessId: string;
  plan: PlanId;
  period: BillingPeriod;
  [key: string]: string;
}

export function subscriptionMetadata(
  businessId: string,
  plan: PlanId,
  period: BillingPeriod
): SubscriptionMetadata {
  return { businessId, plan, period };
}
