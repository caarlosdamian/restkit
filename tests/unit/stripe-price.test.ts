import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requirePriceId, StripePriceMisconfiguredError } from '@/lib/stripe';

/**
 * A wrong id here is not a rendering bug — it is a customer clicking "pagar"
 * and getting nothing, which is the one moment the product has to work.
 */
describe('resolving a Stripe price from env', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(process.env)) if (k.startsWith('STRIPE_PRICE_')) delete process.env[k];
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('returns the price id for the plan and period', () => {
    process.env.STRIPE_PRICE_PRO_ANNUAL = ' price_1TabcDEF ';
    expect(requirePriceId('pro', 'annual')).toBe('price_1TabcDEF');
  });

  it('rejects a PRODUCT id, which is the one the dashboard shows first', () => {
    // prod_… is truthy, so it used to pass straight through to Stripe and come
    // back as an unhandled "No such price" — a blank failed checkout.
    process.env.STRIPE_PRICE_BASIC_MONTHLY = 'prod_VEJajAklpAP3qu';
    expect(() => requirePriceId('basic', 'monthly')).toThrow(StripePriceMisconfiguredError);
    expect(() => requirePriceId('basic', 'monthly')).toThrow(/STRIPE_PRICE_BASIC_MONTHLY/);
    expect(() => requirePriceId('basic', 'monthly')).toThrow(/price_/);
  });

  it('names the exact variable that is missing', () => {
    // Every plan needs its own pair: monthly and annual are two different
    // prices on the same product, and lite is as sellable as pro.
    for (const [plan, period, key] of [
      ['lite', 'monthly', 'STRIPE_PRICE_LITE_MONTHLY'],
      ['lite', 'annual', 'STRIPE_PRICE_LITE_ANNUAL'],
      ['pro', 'monthly', 'STRIPE_PRICE_PRO_MONTHLY'],
    ] as const) {
      expect(() => requirePriceId(plan, period)).toThrow(new RegExp(key));
    }
  });

  it('rejects anything else that is not a price id', () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = '249';
    expect(() => requirePriceId('pro', 'monthly')).toThrow(StripePriceMisconfiguredError);
  });
});
