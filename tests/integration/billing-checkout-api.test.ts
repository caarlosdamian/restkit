import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import Business from '@/models/Business';

// Mock the Stripe client so no network/keys are needed.
const stripeMock = {
  customers: { create: vi.fn(async () => ({ id: 'cus_new' })) },
  checkout: { sessions: { create: vi.fn(async () => ({ url: 'https://checkout.stripe.test/session' })) } },
};
let priceId: string | undefined = 'price_test';
vi.mock('@/lib/stripe', () => ({
  requireStripe: () => stripeMock,
  priceIdFor: () => priceId,
}));

import { POST as checkout } from '@/app/api/billing/checkout/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
  priceId = 'price_test';
  stripeMock.customers.create.mockClear();
  stripeMock.checkout.sessions.create.mockClear();
});

async function makeBusiness(businessId = oid(), extra: Record<string, unknown> = {}) {
  return Business.create({
    _id: businessId,
    name: 'Negocio Test',
    slug: `neg-${businessId.toString()}`,
    settings: { requiredVisits: 10, rewardDescription: 'x' },
    subscription: { status: 'trialing', ...extra },
  });
}

const req = (body: unknown) => jsonRequest('/api/billing/checkout', { method: 'POST', body });

describe('POST /api/billing/checkout', () => {
  it('is OWNER-only', async () => {
    const businessId = oid();
    await makeBusiness(businessId);

    signInAs(businessId, 'ADMIN');
    expect((await checkout(req({ plan: 'pro', period: 'monthly' }))).status).toBe(401);

    resetAuthState();
    expect((await checkout(req({ plan: 'pro' }))).status).toBe(401); // no session
  });

  it('400s for a non-self-serve or unknown plan', async () => {
    const businessId = oid();
    await makeBusiness(businessId);
    signInAs(businessId, 'OWNER');

    expect((await checkout(req({ plan: 'enterprise' }))).status).toBe(400);
    expect((await checkout(req({ plan: 'bogus' }))).status).toBe(400);
  });

  it('500s when the Stripe price id is not configured', async () => {
    const businessId = oid();
    await makeBusiness(businessId);
    signInAs(businessId, 'OWNER');
    priceId = undefined;

    const res = await checkout(req({ plan: 'pro', period: 'monthly' }));
    expect(res.status).toBe(500);
  });

  it('creates a customer + checkout session and returns the url', async () => {
    const businessId = oid();
    await makeBusiness(businessId);
    signInAs(businessId, 'OWNER');

    const res = await checkout(req({ plan: 'pro', period: 'annual' }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe('https://checkout.stripe.test/session');

    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);

    // Customer id persisted for reuse.
    const business = await Business.findById(businessId);
    expect(business!.subscription.stripeCustomerId).toBe('cus_new');
  });

  it('reuses an existing Stripe customer instead of creating a new one', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { stripeCustomerId: 'cus_existing' });
    signInAs(businessId, 'OWNER');

    await checkout(req({ plan: 'basic', period: 'monthly' }));
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });
});
