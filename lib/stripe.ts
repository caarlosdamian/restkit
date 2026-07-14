import Stripe from 'stripe';
import type { BillingPeriod, PlanId } from './plans';

/**
 * Guarded Stripe client. Instantiating without a key is allowed (so builds,
 * tests, and non-billing routes don't crash on import) — call `requireStripe()`
 * in code paths that actually need it, which throws a clear error if the key
 * is missing.
 */
const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = secretKey ? new Stripe(secretKey) : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      'Stripe no está configurado. Define STRIPE_SECRET_KEY en las variables de entorno.'
    );
  }
  return stripe;
}

/**
 * Resolve the Stripe Price ID for a (plan, period) from env. Price IDs come
 * from the Stripe dashboard, e.g. STRIPE_PRICE_PRO_ANNUAL. Kept here (server
 * only) rather than in lib/plans.ts so the pure plan catalog can be imported
 * by client components without leaking env reads.
 */
export function priceIdFor(plan: PlanId, period: BillingPeriod): string | undefined {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
  return process.env[key];
}
