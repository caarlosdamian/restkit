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

/** A STRIPE_PRICE_* env var is missing or is not a price id. A deployment
 *  problem, not a bad request — the message names the variable to fix. */
export class StripePriceMisconfiguredError extends Error {
  readonly code = 'STRIPE_PRICE_MISCONFIGURED';
  readonly envKey: string;
  constructor(envKey: string, detail: string) {
    super(`${envKey}: ${detail}`);
    this.envKey = envKey;
  }
}

/**
 * Resolve the Stripe **Price** ID for a (plan, period) from env, e.g.
 * STRIPE_PRICE_PRO_ANNUAL. Kept here (server only) rather than in lib/plans.ts
 * so the pure plan catalog can be imported by client components without
 * leaking env reads.
 *
 * ⚠️ **The Stripe dashboard shows a product id far more prominently than a
 * price id**, and `prod_…` pasted into one of these is the easy mistake: it is
 * a non-empty string, so it sails past a truthiness check and fails inside
 * Stripe as an unhandled `No such price`, which reaches the owner as a blank
 * failed checkout. One product also carries several prices — monthly and annual
 * are two different `price_` ids — so there is no way to derive one from the
 * other. Validated here, where the fix can be named.
 */
export function requirePriceId(plan: PlanId, period: BillingPeriod): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
  const value = process.env[key]?.trim();

  if (!value) {
    throw new StripePriceMisconfiguredError(
      key,
      `falta la variable de entorno. Cópiala del precio de ${plan}/${period} en Stripe (empieza con "price_").`
    );
  }
  if (value.startsWith('prod_')) {
    throw new StripePriceMisconfiguredError(
      key,
      `tiene el ID del producto (${value}), no el del precio. En Stripe abre el producto y copia el ID del precio en la tabla de precios — empieza con "price_".`
    );
  }
  if (!value.startsWith('price_')) {
    throw new StripePriceMisconfiguredError(
      key,
      `"${value}" no parece un ID de precio de Stripe. Debe empezar con "price_".`
    );
  }
  return value;
}

/**
 * The reverse of `requirePriceId`: which (plan, period) a Stripe price belongs to.
 *
 * ⚠️ This is what lets a subscription created OUTSIDE Checkout land on the
 * right tier. `billingService` used to read the plan only from the
 * subscription's metadata, and a subscription made in the Stripe dashboard
 * carries none — so it granted access while leaving `Business.subscription.plan`
 * at whatever signup defaulted to. Sell someone Lite that way and they run as
 * Profesional while paying $249, silently.
 *
 * The price id was there the whole time; nothing was reading it. Metadata still
 * wins when present (it is explicit, and it survives a price being swapped for
 * a grandfathered one), and an unrecognised price returns null so the caller
 * leaves the plan alone rather than guessing.
 *
 * Reads env on every call rather than caching: these are bound at build time on
 * Vercel, but a long-lived server that was started before a variable was fixed
 * should pick it up without a redeploy.
 */
export function planForPriceId(
  priceId: string | null | undefined
): { plan: PlanId; period: BillingPeriod } | null {
  const wanted = priceId?.trim();
  if (!wanted) return null;

  for (const plan of ['lite', 'basic', 'pro'] as const) {
    for (const period of ['monthly', 'annual'] as const) {
      const configured = process.env[
        `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`
      ]?.trim();
      if (configured && configured === wanted) return { plan, period };
    }
  }
  return null;
}
