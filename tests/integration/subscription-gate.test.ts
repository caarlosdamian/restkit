import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import { POST as startSession } from '@/app/api/pos-session/start/route';
import Business from '@/models/Business';
import POSSession from '@/models/POSSession';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function makeBusiness(businessId: ReturnType<typeof oid>, sub: Record<string, unknown>) {
  return Business.create({
    _id: businessId,
    name: 'Negocio Test',
    slug: `neg-${businessId.toString()}`,
    settings: { loyalty: { sellos: { required: 10, rewardDescription: 'x' } } },
    subscription: sub,
  });
}

const start = () =>
  startSession(jsonRequest('/api/pos-session/start', { method: 'POST', body: { openingBalance: 500 } }));

describe('subscription gate on opening the register', () => {
  it('blocks (402) when the trial has expired and there is no payment', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'trialing', trialEndsAt: daysFromNow(-1) });
    signInAs(businessId, 'OWNER');

    const res = await start();
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('SUBSCRIPTION_REQUIRED');
    expect(await POSSession.countDocuments({ businessId })).toBe(0); // no shift opened
  });

  it('allows a business still in trial', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'trialing', trialEndsAt: daysFromNow(5) });
    signInAs(businessId, 'OWNER');
    expect((await start()).status).toBe(201);
  });

  it('allows an active subscription', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'active' });
    signInAs(businessId, 'OWNER');
    expect((await start()).status).toBe(201);
  });

  it('grandfathers a business with no subscription document (never locked out)', async () => {
    const businessId = oid();
    // No Business doc at all — mirrors legacy/seed data.
    signInAs(businessId, 'OWNER');
    expect((await start()).status).toBe(201);
  });

  it('blocks a past_due subscription', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'past_due' });
    signInAs(businessId, 'OWNER');
    expect((await start()).status).toBe(402);
  });
});
