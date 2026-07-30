import { describe, it, expect } from 'vitest';
import { evaluateSubscription, featureAllowed } from '@/lib/subscription';
import type { ISubscription } from '@/models/Business';

const NOW = new Date('2026-07-12T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe('evaluateSubscription', () => {
  it('grandfathers a missing subscription (legacy/seed) — never gated', () => {
    const v = evaluateSubscription(undefined, NOW);
    expect(v).toMatchObject({ active: true, needsUpgrade: false, status: 'none' });
  });

  it('grandfathers a subscription object with no status', () => {
    const v = evaluateSubscription({ stripeCustomerId: 'cus_1' } as ISubscription, NOW);
    expect(v.needsUpgrade).toBe(false);
    expect(v.active).toBe(true);
  });

  it('trialing with time left is active and reports whole days remaining', () => {
    const v = evaluateSubscription({ status: 'trialing', trialEndsAt: inDays(5) }, NOW);
    expect(v).toMatchObject({ active: true, trialing: true, needsUpgrade: false });
    expect(v.trialDaysLeft).toBe(5);
  });

  it('rounds partial trial days up', () => {
    const v = evaluateSubscription(
      { status: 'trialing', trialEndsAt: new Date(NOW.getTime() + 1.2 * 24 * 60 * 60 * 1000) },
      NOW
    );
    expect(v.trialDaysLeft).toBe(2);
  });

  it('trialing past trialEndsAt is expired → needsUpgrade', () => {
    const v = evaluateSubscription({ status: 'trialing', trialEndsAt: inDays(-1) }, NOW);
    expect(v).toMatchObject({ active: false, trialing: false, needsUpgrade: true, trialDaysLeft: 0 });
  });

  it('active subscription has access', () => {
    const v = evaluateSubscription({ status: 'active', currentPeriodEnd: inDays(20) }, NOW);
    expect(v).toMatchObject({ active: true, needsUpgrade: false, status: 'active' });
  });

  it('past_due is gated', () => {
    const v = evaluateSubscription({ status: 'past_due' }, NOW);
    expect(v).toMatchObject({ active: false, needsUpgrade: true });
  });

  it('canceled is gated once the paid period has passed', () => {
    const v = evaluateSubscription({ status: 'canceled', currentPeriodEnd: inDays(-1) }, NOW);
    expect(v.needsUpgrade).toBe(true);
  });

  it('canceled but still inside the paid period keeps access (cancel-at-period-end)', () => {
    const v = evaluateSubscription({ status: 'canceled', currentPeriodEnd: inDays(10) }, NOW);
    expect(v).toMatchObject({ active: true, needsUpgrade: false });
  });

  describe('subscribed signal (purchased plan vs bare trial)', () => {
    it('bare app-trial (customer id only, no subscription id) is NOT subscribed', () => {
      // Mirrors the real injected object: trialing + stripeCustomerId + no sub id.
      const v = evaluateSubscription(
        {
          plan: 'basic',
          billingPeriod: 'monthly',
          status: 'trialing',
          trialEndsAt: inDays(14),
          stripeCustomerId: 'cus_UsHksXb09rDmxU',
        } as ISubscription,
        NOW
      );
      expect(v.subscribed).toBe(false);
      expect(v).toMatchObject({ active: true, trialing: true });
    });

    it('trialing WITH a stripeSubscriptionId is subscribed (Stripe trial on a purchased plan)', () => {
      const v = evaluateSubscription(
        {
          plan: 'basic',
          status: 'trialing',
          trialEndsAt: inDays(10),
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
        } as ISubscription,
        NOW
      );
      expect(v.subscribed).toBe(true);
      expect(v).toMatchObject({ trialing: true, needsUpgrade: false });
    });

    it('active is always subscribed', () => {
      const v = evaluateSubscription({ status: 'active', currentPeriodEnd: inDays(20) }, NOW);
      expect(v.subscribed).toBe(true);
    });

    it('past_due with a subscription id is still subscribed (payment retrying)', () => {
      const v = evaluateSubscription(
        { status: 'past_due', stripeSubscriptionId: 'sub_1' } as ISubscription,
        NOW
      );
      expect(v.subscribed).toBe(true);
    });

    it('grandfathered / none is not subscribed', () => {
      expect(evaluateSubscription(undefined, NOW).subscribed).toBe(false);
    });
  });

  describe('date coercion across lean/JSON boundaries', () => {
    it('accepts an ISO string trialEndsAt (serialized to a client/JSON)', () => {
      const v = evaluateSubscription(
        { status: 'trialing', trialEndsAt: inDays(5).toISOString() as unknown as Date },
        NOW
      );
      expect(v).toMatchObject({ active: true, trialing: true, trialDaysLeft: 5 });
    });

    it('accepts an ISO string currentPeriodEnd for a canceled sub still in period', () => {
      const v = evaluateSubscription(
        { status: 'canceled', currentPeriodEnd: inDays(10).toISOString() as unknown as Date },
        NOW
      );
      expect(v).toMatchObject({ active: true, needsUpgrade: false });
    });

    it('accepts an epoch-ms number date', () => {
      const v = evaluateSubscription(
        { status: 'trialing', trialEndsAt: inDays(3).getTime() as unknown as Date },
        NOW
      );
      expect(v.trialDaysLeft).toBe(3);
    });
  });
});

describe('featureAllowed (tier gate)', () => {
  // Purchased = both Stripe ids present, so these fixtures are unambiguous
  // regardless of which id `subscribed` keys off.
  const purchased = (plan: 'basic' | 'pro') =>
    ({
      plan,
      status: 'active',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      currentPeriodEnd: inDays(20),
    }) as ISubscription;

  it('grandfathered (no subscription) gets every feature', () => {
    expect(featureAllowed(undefined, 'inventory', NOW)).toBe(true);
    expect(featureAllowed(null, 'kds', NOW)).toBe(true);
  });

  it('bare free trial (no Stripe ids) gets every feature — tier bites only when paying', () => {
    const trial = { plan: 'basic', status: 'trialing', trialEndsAt: inDays(10) } as ISubscription;
    expect(featureAllowed(trial, 'inventory', NOW)).toBe(true);
    expect(featureAllowed(trial, 'kds', NOW)).toBe(true);
    expect(featureAllowed(trial, 'reports', NOW)).toBe(true);
  });

  it('purchased basic loses pro-only features', () => {
    expect(featureAllowed(purchased('basic'), 'inventory', NOW)).toBe(false);
    expect(featureAllowed(purchased('basic'), 'kds', NOW)).toBe(false);
    expect(featureAllowed(purchased('basic'), 'reports', NOW)).toBe(false);
  });

  it('purchased pro keeps everything', () => {
    expect(featureAllowed(purchased('pro'), 'inventory', NOW)).toBe(true);
    expect(featureAllowed(purchased('pro'), 'kds', NOW)).toBe(true);
  });

  it('purchased basic still in Stripe trial is already tier-gated', () => {
    const sub = {
      plan: 'basic',
      status: 'trialing',
      trialEndsAt: inDays(10),
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    } as ISubscription;
    expect(featureAllowed(sub, 'inventory', NOW)).toBe(false);
  });

  it('purchased sub with no recorded plan is never wrongly locked out', () => {
    const sub = {
      status: 'active',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    } as ISubscription;
    expect(featureAllowed(sub, 'inventory', NOW)).toBe(true);
  });
});
