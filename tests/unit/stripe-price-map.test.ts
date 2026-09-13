import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { planForPriceId, requirePriceId } from '@/lib/stripe';
import { PLANS } from '@/lib/plans';

/**
 * `planForPriceId` is what makes a subscription created outside Checkout land
 * on the right tier, so it has to be the exact inverse of `requirePriceId` —
 * they read the same six variables and a drift between them is a business
 * running one plan and paying for another.
 */

const KEYS = ['LITE', 'BASIC', 'PRO'].flatMap((p) =>
  ['MONTHLY', 'ANNUAL'].map((period) => `STRIPE_PRICE_${p}_${period}`)
);

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const [i, key] of KEYS.entries()) process.env[key] = `price_${i}`;
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('price id → plan', () => {
  it('round-trips every plan and period', () => {
    for (const plan of PLANS) {
      for (const period of ['monthly', 'annual'] as const) {
        const priceId = requirePriceId(plan.id, period);
        expect(planForPriceId(priceId)).toEqual({ plan: plan.id, period });
      }
    }
  });

  it('tells monthly and annual apart — they are different prices', () => {
    const monthly = planForPriceId(requirePriceId('basic', 'monthly'));
    const annual = planForPriceId(requirePriceId('basic', 'annual'));
    expect(monthly!.period).toBe('monthly');
    expect(annual!.period).toBe('annual');
  });

  it('returns null rather than guessing', () => {
    // A one-off or grandfathered price. The caller leaves the plan alone.
    expect(planForPriceId('price_not_ours')).toBeNull();
    expect(planForPriceId('')).toBeNull();
    expect(planForPriceId(null)).toBeNull();
    expect(planForPriceId(undefined)).toBeNull();
  });

  it('ignores a variable that is not set, instead of matching undefined', () => {
    // Every unset variable would otherwise "equal" a missing price id and the
    // first plan in the list would win every lookup.
    delete process.env.STRIPE_PRICE_LITE_MONTHLY;
    expect(planForPriceId(undefined)).toBeNull();
    expect(planForPriceId('price_0')).toBeNull();
  });

  it('tolerates surrounding whitespace in the env var', () => {
    process.env.STRIPE_PRICE_PRO_ANNUAL = '  price_spaced  ';
    expect(planForPriceId('price_spaced')).toEqual({ plan: 'pro', period: 'annual' });
  });
});
