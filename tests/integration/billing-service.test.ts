import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type Stripe from 'stripe';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { oid } from '../helpers/fixtures';
import { billingService } from '@/services/billing.service';
import Business from '@/models/Business';

// Mock the Stripe client so syncSubscriptionFromStripe can be driven without a
// real API. `listResult` is swapped per-test; applyStripeEvent tests don't
// touch Stripe so they're unaffected.
let listResult: { data: unknown[] } = { data: [] };
vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      list: vi.fn(async () => listResult),
    },
  },
}));

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(() => {
  listResult = { data: [] };
  return clearTestDb();
});

const PERIOD_END = Math.floor(new Date('2026-08-12T00:00:00Z').getTime() / 1000);

/** Minimal synthetic Stripe subscription event for the handler. Loosely typed
 *  on purpose — we hand-build just the fields billingService reads, across
 *  Stripe API versions where current_period_end lives in different places. */
function subEvent(
  type: 'customer.subscription.updated' | 'customer.subscription.deleted',
  sub: Record<string, unknown>
): Stripe.Event {
  return {
    id: 'evt_test',
    type,
    data: { object: sub },
  } as unknown as Stripe.Event;
}

async function makeBusiness(extra: Record<string, unknown> = {}) {
  return Business.create({
    name: 'Negocio Test',
    slug: `neg-${oid().toString()}`,
    settings: { loyalty: { sellos: { required: 10, rewardDescription: 'x' } } },
    subscription: { status: 'trialing', trialEndsAt: new Date(), ...extra },
  });
}

describe('billingService.applyStripeEvent', () => {
  it('activates the business on customer.subscription.updated (matched by metadata.businessId)', async () => {
    const business = await makeBusiness({ stripeCustomerId: 'cus_1' });

    await billingService.applyStripeEvent(
      subEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'active',
        customer: 'cus_1',
        current_period_end: PERIOD_END,
        items: { data: [{ current_period_end: PERIOD_END }] } as never,
        metadata: { businessId: business._id.toString(), plan: 'pro', period: 'annual' },
      })
    );

    const updated = await Business.findById(business._id);
    expect(updated!.subscription.status).toBe('active');
    expect(updated!.subscription.stripeSubscriptionId).toBe('sub_1');
    expect(updated!.subscription.plan).toBe('pro');
    expect(updated!.subscription.billingPeriod).toBe('annual');
    expect(updated!.subscription.currentPeriodEnd!.getTime()).toBe(PERIOD_END * 1000);
  });

  it('falls back to matching by stripeCustomerId when metadata has no businessId', async () => {
    const business = await makeBusiness({ stripeCustomerId: 'cus_2' });

    await billingService.applyStripeEvent(
      subEvent('customer.subscription.updated', {
        id: 'sub_2',
        status: 'active',
        customer: 'cus_2',
        current_period_end: PERIOD_END,
      })
    );

    const updated = await Business.findById(business._id);
    expect(updated!.subscription.status).toBe('active');
  });

  it('maps past_due and marks the business past_due', async () => {
    const business = await makeBusiness({ stripeCustomerId: 'cus_3' });
    await billingService.applyStripeEvent(
      subEvent('customer.subscription.updated', {
        id: 'sub_3',
        status: 'past_due',
        customer: 'cus_3',
        metadata: { businessId: business._id.toString() },
      })
    );
    expect((await Business.findById(business._id))!.subscription.status).toBe('past_due');
  });

  it('cancels the business on customer.subscription.deleted', async () => {
    const business = await makeBusiness({ stripeCustomerId: 'cus_4', status: 'active' });
    await billingService.applyStripeEvent(
      subEvent('customer.subscription.deleted', {
        id: 'sub_4',
        status: 'canceled',
        customer: 'cus_4',
        metadata: { businessId: business._id.toString() },
      })
    );
    expect((await Business.findById(business._id))!.subscription.status).toBe('canceled');
  });

  it('is a no-op for an unknown tenant (no matching business)', async () => {
    await billingService.applyStripeEvent(
      subEvent('customer.subscription.updated', {
        id: 'sub_x',
        status: 'active',
        customer: 'cus_unknown',
      })
    );
    expect(await Business.countDocuments()).toBe(0);
  });

  it('ignores unrelated event types', async () => {
    const business = await makeBusiness({ stripeCustomerId: 'cus_5' });
    await billingService.applyStripeEvent({
      id: 'evt_2',
      type: 'invoice.paid',
      data: { object: {} as never },
    } as unknown as Stripe.Event);
    // status untouched
    expect((await Business.findById(business._id))!.subscription.status).toBe('trialing');
  });
});

describe('billingService.syncSubscriptionFromStripe', () => {
  it('reconciles a trialing-but-purchased business from Stripe (webhook missed)', async () => {
    // The stuck state: app trial recorded, customer created, but no sub id yet.
    const business = await makeBusiness({
      plan: 'basic',
      billingPeriod: 'monthly',
      stripeCustomerId: 'cus_sync',
    });

    listResult = {
      data: [
        {
          id: 'sub_sync',
          status: 'trialing',
          customer: 'cus_sync',
          current_period_end: PERIOD_END,
          metadata: { businessId: business._id.toString(), plan: 'pro', period: 'annual' },
        },
      ],
    };

    await billingService.syncSubscriptionFromStripe('cus_sync');

    const updated = await Business.findById(business._id);
    expect(updated!.subscription.stripeSubscriptionId).toBe('sub_sync');
    expect(updated!.subscription.status).toBe('trialing');
    expect(updated!.subscription.plan).toBe('pro');
  });

  it('is a no-op when the customer has no Stripe subscription', async () => {
    const business = await makeBusiness({ stripeCustomerId: 'cus_none' });
    listResult = { data: [] };

    await billingService.syncSubscriptionFromStripe('cus_none');

    const updated = await Business.findById(business._id);
    expect(updated!.subscription.stripeSubscriptionId).toBeUndefined();
    expect(updated!.subscription.status).toBe('trialing');
  });
});
