import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid, routeParams } from '../helpers/fixtures';
import Business from '@/models/Business';
import Customer, { newPublicToken } from '@/models/Customer';
import Order from '@/models/Order';
import Table from '@/models/Table';
import Visit from '@/models/Visit';
import POSSession from '@/models/POSSession';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';

vi.mock('@/lib/apple-push', () => ({ sendAppleWalletPush: vi.fn(async () => {}) }));
vi.mock('@/lib/google-wallet', () => ({
  updateGoogleWalletObject: vi.fn(async () => {}),
  generateGoogleWalletUrl: vi.fn(() => 'https://pay.google.test/x'),
}));

import { PATCH as patchOrder } from '@/app/api/orders/[orderId]/route';
import { POST as closeSession } from '@/app/api/pos-session/close/route';
import { GET as currentSession } from '@/app/api/pos-session/current/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

/** A café running cashback, an open register, and a regular with a balance. */
async function shift(balance = 128) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: {
      loyalty: { ...DEFAULT_LOYALTY, mechanic: 'cashback', cashback: { rate: 5, threshold: 100 } },
    },
  });
  const customer = await Customer.create({
    name: 'Ana P.',
    phone: '5512345678',
    businessId,
    stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: balance },
    publicToken: newPublicToken(),
    externalIds: { appleAuthToken: 'tok' },
  });
  const table = await Table.create({ businessId, number: 4, name: 'Mesa 4', capacity: 4 });
  const user = signInAs(businessId, 'OWNER');

  await POSSession.create({
    businessId,
    staffId: oid(),
    staffName: 'Gerente Test',
    startedAt: new Date(Date.now() - 60_000),
    openingBalance: 500,
    status: 'OPEN',
  });

  const order = await Order.create({
    businessId,
    tableId: table._id,
    tableName: 'Mesa 4',
    staffId: oid(),
    status: 'READY',
    items: [{ productId: oid(), name: 'Comida', price: 340, quantity: 1 }],
    total: 340,
  });

  return { businessId, customer, order, user };
}

const pay = (orderId: string, body: Record<string, unknown>) =>
  patchOrder(
    jsonRequest(`/api/orders/${orderId}`, { method: 'PATCH', body }),
    routeParams({ orderId })
  );

describe('a shift where a customer spends their balance', () => {
  it('charges the difference and gives change on it', async () => {
    const { customer, order } = await shift(128);

    const res = await pay(String(order._id), {
      status: 'PAID',
      paymentMethod: 'CASH',
      amountReceived: 220,
      customerId: String(customer._id),
      cashbackApplied: 128,
    });
    const data = await res.json();

    expect(data.cashbackApplied).toBe(128);
    // Ana owes 340 − 128 = 212, hands over 220, gets 8 back.
    expect(data.change).toBe(8);
  });

  it('leaves the cash-up balanced instead of showing a phantom shortfall', async () => {
    const { customer, order } = await shift(128);

    await pay(String(order._id), {
      status: 'PAID',
      paymentMethod: 'CASH',
      amountReceived: 212,
      customerId: String(customer._id),
      cashbackApplied: 128,
    });

    // The manager counts the float plus the $212 that actually came in.
    const res = await closeSession(
      jsonRequest('/api/pos-session/close', { method: 'POST', body: { closingBalance: 712 } })
    );
    const { cut } = await res.json();

    expect(cut.cashSales).toBe(212);
    expect(cut.cashbackRedeemed).toBe(128);
    expect(cut.totalSales).toBe(340);
    expect(cut.expectedCash).toBe(712);
    // Before the split, expectedCash was 840 and this read as $128 missing.
    expect(cut.variance).toBe(0);
  });

  it('reports the same split on the live session', async () => {
    const { customer, order } = await shift(128);
    await pay(String(order._id), {
      status: 'PAID',
      paymentMethod: 'CASH',
      amountReceived: 212,
      customerId: String(customer._id),
      cashbackApplied: 128,
    });

    const res = await currentSession();
    const { session } = await res.json();

    expect(session.cashSales).toBe(212);
    expect(session.cashbackRedeemed).toBe(128);
  });

  it('accrues on the gross bill, not on what was paid', async () => {
    const { customer, order } = await shift(128);
    await pay(String(order._id), {
      status: 'PAID',
      paymentMethod: 'CASH',
      amountReceived: 212,
      customerId: String(customer._id),
      cashbackApplied: 128,
    });

    // 5% of 340 = 17 earned back, against the 128 just spent.
    const fresh = await Customer.findById(customer._id);
    expect(fresh!.stats.cashbackBalance).toBe(17);
  });

  it('applies nothing when the balance is below the threshold', async () => {
    const { customer, order } = await shift(87);

    const res = await pay(String(order._id), {
      status: 'PAID',
      paymentMethod: 'CASH',
      amountReceived: 340,
      customerId: String(customer._id),
      cashbackApplied: 87,
    });
    const data = await res.json();

    expect(data.cashbackApplied).toBe(0);
    expect(data.change).toBe(0);
    // Balance untouched, plus the 17 earned on this order.
    expect((await Customer.findById(customer._id))!.stats.cashbackBalance).toBe(104);
  });

  it('honours stamps earned before the business switched to cashback', async () => {
    // Decision 19: switching freezes the old side but never wipes it. A regular
    // sitting on a completed card must still be able to claim it.
    const { businessId, customer, order } = await shift(0);
    await Customer.updateOne({ _id: customer._id }, { $set: { 'stats.currentVisits': 10 } });

    const res = await pay(String(order._id), {
      status: 'PAID',
      paymentMethod: 'CASH',
      amountReceived: 340,
      customerId: String(customer._id),
      redeemReward: true,
    });
    const data = await res.json();

    expect(data.rewardRedeemed).toBe(true);
    expect(await Visit.countDocuments({ businessId, type: 'REWARD_REDEMPTION', mechanic: 'sellos' })).toBe(1);

    // Stamps consumed; new earning goes to the active mechanic.
    const fresh = await Customer.findById(customer._id);
    expect(fresh!.stats.currentVisits).toBe(0);
    expect(fresh!.stats.cashbackBalance).toBe(17);
  });

  it('cannot spend more balance than the customer has', async () => {
    const { customer, order } = await shift(128);

    const res = await pay(String(order._id), {
      status: 'PAID',
      paymentMethod: 'CARD',
      customerId: String(customer._id),
      cashbackApplied: 5000,
    });

    expect((await res.json()).cashbackApplied).toBe(128);
    expect(await Visit.countDocuments({ type: 'REWARD_REDEMPTION', mechanic: 'cashback' })).toBe(1);
  });
});
