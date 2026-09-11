import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import { POST as startSession } from '@/app/api/pos-session/start/route';
import { POST as createOrder } from '@/app/api/orders/route';
import { PATCH as patchOrder } from '@/app/api/orders/[orderId]/route';
import Business from '@/models/Business';
import POSSession from '@/models/POSSession';
import Order from '@/models/Order';
import Table from '@/models/Table';

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


describe('subscription gate on selling', () => {
  // The register's 402 was only a funnel: a terminal signed in before the trial
  // lapsed kept its cookie, and the order routes never re-checked. These cover
  // the routes that actually move money.

  async function table(businessId: ReturnType<typeof oid>) {
    return Table.create({ businessId, number: 1, name: 'Mesa 1' });
  }

  const open = (tableId: string) =>
    createOrder(jsonRequest('/api/orders', { method: 'POST', body: { tableId } }));

  const patch = (orderId: string, body: Record<string, unknown>) =>
    patchOrder(jsonRequest(`/api/orders/${orderId}`, { method: 'PATCH', body }), {
      params: Promise.resolve({ orderId }),
    });

  it('blocks opening an order (402) once the trial has expired', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'trialing', trialEndsAt: daysFromNow(-1) });
    const t = await table(businessId);
    signInAs(businessId, 'OWNER');

    const res = await open(t._id.toString());
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('SUBSCRIPTION_REQUIRED');
    expect(await Order.countDocuments({ businessId })).toBe(0);
  });

  it('allows opening an order during the trial', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'trialing', trialEndsAt: daysFromNow(5) });
    const t = await table(businessId);
    signInAs(businessId, 'OWNER');
    expect((await open(t._id.toString())).status).toBe(201);
  });

  it('blocks payment and adding items on an order opened before expiry', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'trialing', trialEndsAt: daysFromNow(5) });
    const t = await table(businessId);
    signInAs(businessId, 'OWNER');
    const order = await (await open(t._id.toString())).json();

    // The trial lapses mid-shift.
    await Business.updateOne({ _id: businessId }, { 'subscription.trialEndsAt': daysFromNow(-1) });

    const items = await patch(order._id, {
      items: [{ productId: oid().toString(), name: 'Tacos', price: 50, quantity: 1 }],
    });
    expect(items.status).toBe(402);

    const paid = await patch(order._id, { status: 'PAID', paymentMethod: 'CASH' });
    expect(paid.status).toBe(402);
    expect((await Order.findById(order._id))!.status).not.toBe('PAID');
  });

  it('still allows cancelling and kitchen transitions, so no table is trapped', async () => {
    const businessId = oid();
    await makeBusiness(businessId, { status: 'trialing', trialEndsAt: daysFromNow(5) });
    const t = await table(businessId);
    signInAs(businessId, 'OWNER');
    const order = await (await open(t._id.toString())).json();

    await Business.updateOne({ _id: businessId }, { 'subscription.trialEndsAt': daysFromNow(-1) });

    expect((await patch(order._id, { status: 'IN_KITCHEN' })).status).toBe(200);

    expect((await patch(order._id, { status: 'CANCELLED' })).status).toBe(200);
    // The table is freed, not left busy for ever.
    expect((await Table.findById(t._id))!.isOccupied).toBe(false);
  });

  it('grandfathers a business with no subscription document', async () => {
    const businessId = oid();
    const t = await table(businessId);
    signInAs(businessId, 'OWNER');
    expect((await open(t._id.toString())).status).toBe(201);
  });
});
