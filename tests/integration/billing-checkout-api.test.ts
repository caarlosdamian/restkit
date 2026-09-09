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
// `priceMisconfigured` stands in for a bad STRIPE_PRICE_* env var. The real
// requirePriceId THROWS rather than returning undefined, so the mock has to as
// well — a mock that returns undefined would let the route sail on to Stripe
// and the test would pass while production 500s from inside the SDK.
const { priceState, MockPriceError } = vi.hoisted(() => {
  class MockPriceError extends Error {
    readonly code = 'STRIPE_PRICE_MISCONFIGURED';
    constructor(readonly envKey: string, detail: string) {
      super(`${envKey}: ${detail}`);
    }
  }
  return { priceState: { id: 'price_test' as string | undefined }, MockPriceError };
});

vi.mock('@/lib/stripe', () => ({
  requireStripe: () => stripeMock,
  StripePriceMisconfiguredError: MockPriceError,
  requirePriceId: () => {
    if (!priceState.id) throw new MockPriceError('STRIPE_PRICE_PRO_MONTHLY', 'falta la variable de entorno.');
    return priceState.id;
  },
}));

import { POST as checkout } from '@/app/api/billing/checkout/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
  priceState.id = 'price_test';
  stripeMock.customers.create.mockClear();
  stripeMock.checkout.sessions.create.mockClear();
});

async function makeBusiness(businessId = oid(), extra: Record<string, unknown> = {}) {
  return Business.create({
    _id: businessId,
    name: 'Negocio Test',
    slug: `neg-${businessId.toString()}`,
    settings: { loyalty: { sellos: { required: 10, rewardDescription: 'x' } } },
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

  it('400s for an unknown plan', async () => {
    const businessId = oid();
    await makeBusiness(businessId);
    signInAs(businessId, 'OWNER');

    expect((await checkout(req({ plan: 'bogus' }))).status).toBe(400);
  });

  it('checkout works for the Lite plan too', async () => {
    const businessId = oid();
    await makeBusiness(businessId);
    signInAs(businessId, 'OWNER');

    const res = await checkout(req({ plan: 'lite', period: 'monthly' }));
    expect(res.status).toBe(200);
  });

  it('500s with the variable to fix when the Stripe price id is misconfigured', async () => {
    const businessId = oid();
    await makeBusiness(businessId);
    signInAs(businessId, 'OWNER');
    priceState.id = undefined;

    const res = await checkout(req({ plan: 'pro', period: 'monthly' }));
    expect(res.status).toBe(500);
    // The owner sees this, so it has to name what to change — not "algo salió mal".
    const body = await res.json();
    expect(body.code).toBe('STRIPE_PRICE_MISCONFIGURED');
    expect(body.error).toContain('STRIPE_PRICE_PRO_MONTHLY');
    // And nothing was charged for: no Stripe session was ever opened.
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('explains a price Stripe cannot find, which is always a mode or account mix-up', async () => {
    const businessId = oid();
    await makeBusiness(businessId);
    signInAs(businessId, 'OWNER');
    // What Stripe answers for a live price used under a test key. The id is
    // well-formed, so nothing before this point can catch it.
    stripeMock.checkout.sessions.create.mockRejectedValueOnce(
      Object.assign(new Error('No such price'), { code: 'resource_missing', type: 'StripeInvalidRequestError' })
    );

    const res = await checkout(req({ plan: 'lite', period: 'annual' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('STRIPE_PRICE_NOT_FOUND');
    expect(body.error).toContain('STRIPE_PRICE_LITE_ANNUAL');
    expect(body.error).toMatch(/modo (test|live)/);
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
