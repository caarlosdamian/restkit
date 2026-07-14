import { describe, it, expect } from 'vitest';
import { evaluateSubscription } from '@/lib/subscription';
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
