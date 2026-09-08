import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid, routeParams } from '../helpers/fixtures';
import Business from '@/models/Business';
import Customer, { newPublicToken } from '@/models/Customer';
import Order from '@/models/Order';
import Table from '@/models/Table';
import Visit from '@/models/Visit';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';

vi.mock('@/lib/apple-push', () => ({ sendAppleWalletPush: vi.fn(async () => {}) }));
vi.mock('@/lib/google-wallet', () => ({
  updateGoogleWalletObject: vi.fn(async () => {}),
  generateGoogleWalletUrl: vi.fn(() => 'https://pay.google.test/x'),
}));

import { GET as lookup, POST as enrol } from '@/app/api/pos/customers/lookup/route';
import { PATCH as patchOrder } from '@/app/api/orders/[orderId]/route';
import {
  GET as getHistory,
  POST as reverseEntry,
} from '@/app/api/customers/[customerId]/history/route';
import { POST as recordVisit } from '@/app/api/visits/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

async function scenario(currentVisits = 0) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: { loyalty: DEFAULT_LOYALTY },
  });
  const customer = await Customer.create({
    name: 'Ana P.',
    phone: '5512345678',
    businessId,
    stats: { totalVisits: 0, currentVisits, cashbackBalance: 0 },
    publicToken: newPublicToken(),
    externalIds: { appleAuthToken: 'tok' },
  });
  const table = await Table.create({ businessId, number: 4, name: 'Mesa 4', capacity: 4 });
  const user = signInAs(businessId, 'OWNER');
  const order = await Order.create({
    businessId,
    tableId: table._id,
    tableName: 'Mesa 4',
    staffId: oid(),
    status: 'READY',
    items: [{ productId: oid(), name: 'Café', price: 170, quantity: 2 }],
    total: 340,
  });
  return { businessId, customer, order, user };
}

describe('POS customer lookup', () => {
  it('needs a terminal session', async () => {
    await scenario();
    resetAuthState();
    const res = await lookup(jsonRequest('/api/pos/customers/lookup?phone=5512'));
    expect(res.status).toBe(401);
  });

  it('finds by the last four digits and returns progress, not just a name', async () => {
    await scenario(3);
    const res = await lookup(jsonRequest('/api/pos/customers/lookup?phone=5678&total=340'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].name).toBe('Ana P.');
    // "le faltan 7" is what makes the waiter mention it at the counter.
    expect(data.results[0].stamps).toBe(3);
    expect(data.results[0].required).toBe(10);
  });

  it('ignores fewer than four digits', async () => {
    await scenario();
    const res = await lookup(jsonRequest('/api/pos/customers/lookup?phone=55'));
    expect((await res.json()).results).toEqual([]);
  });

  it('never returns another business customer', async () => {
    await scenario();
    signInAs(oid(), 'OWNER'); // different business
    const res = await lookup(jsonRequest('/api/pos/customers/lookup?phone=5512345678'));
    expect((await res.json()).results).toEqual([]);
  });

  it('enrols a walk-in from a phone number alone', async () => {
    const { businessId } = await scenario();
    const res = await enrol(
      jsonRequest('/api/pos/customers/lookup', { method: 'POST', body: { phone: '5599887766' } })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toContain('7766');
    const created = await Customer.findOne({ businessId, phone: '5599887766' });
    expect(created!.publicToken).toHaveLength(40);
    expect(created!.externalIds.appleAuthToken).toBeTruthy();
  });

  it('enrols a second phone-only walk-in', async () => {
    // Regression: the {businessId, email} index was `sparse`, which still
    // indexes an explicit null — so the second customer with no email hit a
    // duplicate-key error and enrolment 500'd for everyone after the first.
    await scenario();
    const first = await enrol(
      jsonRequest('/api/pos/customers/lookup', { method: 'POST', body: { phone: '5599887766' } })
    );
    const second = await enrol(
      jsonRequest('/api/pos/customers/lookup', { method: 'POST', body: { phone: '5511223344' } })
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await Customer.countDocuments()).toBe(3);
  });

  it('returns the existing customer instead of a duplicate', async () => {
    const { customer } = await scenario();
    const res = await enrol(
      jsonRequest('/api/pos/customers/lookup', { method: 'POST', body: { phone: '5512345678' } })
    );
    expect((await res.json()).id).toBe(String(customer._id));
    expect(await Customer.countDocuments()).toBe(1);
  });

  it('rejects a short phone number', async () => {
    await scenario();
    const res = await enrol(
      jsonRequest('/api/pos/customers/lookup', { method: 'POST', body: { phone: '5512' } })
    );
    expect(res.status).toBe(400);
  });
});

describe('paying an order with a customer attached', () => {
  it('stamps the card and hands back a card link for the ticket', async () => {
    const { customer, order } = await scenario(0);

    const res = await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, {
        method: 'PATCH',
        body: { status: 'PAID', paymentMethod: 'CASH', amountReceived: 400, customerId: String(customer._id) },
      }),
      routeParams({ orderId: String(order._id) })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.loyalty.earned).toBe(true);
    expect(data.loyalty.stamps).toBe(1);
    expect(data.loyalty.cardUrl).toContain(customer.publicToken);
    expect(data.loyalty.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect((await Customer.findById(customer._id))!.stats.currentVisits).toBe(1);
  });

  it('earns nothing when no customer is attached', async () => {
    const { order } = await scenario();
    const res = await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, {
        method: 'PATCH',
        body: { status: 'PAID', paymentMethod: 'CARD' },
      }),
      routeParams({ orderId: String(order._id) })
    );
    expect((await res.json()).loyalty).toBeUndefined();
    expect(await Visit.countDocuments()).toBe(0);
  });

  it('does not double-stamp when the PATCH is retried', async () => {
    const { customer, order } = await scenario();
    const body = { status: 'PAID', paymentMethod: 'CARD', customerId: String(customer._id) };
    const req = () =>
      patchOrder(
        jsonRequest(`/api/orders/${order._id}`, { method: 'PATCH', body }),
        routeParams({ orderId: String(order._id) })
      );

    await req();
    await req();

    expect(await Visit.countDocuments({ type: 'ACCRUAL' })).toBe(1);
    expect((await Customer.findById(customer._id))!.stats.currentVisits).toBe(1);
  });

  it('claims a completed card and computes change on the discounted amount', async () => {
    const { customer, order } = await scenario(10);

    const res = await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, {
        method: 'PATCH',
        body: {
          status: 'PAID',
          paymentMethod: 'CASH',
          amountReceived: 400,
          customerId: String(customer._id),
          redeemReward: true,
        },
      }),
      routeParams({ orderId: String(order._id) })
    );
    const data = await res.json();

    expect(data.rewardRedeemed).toBe(true);
    expect(data.change).toBe(60);
    expect(await Visit.countDocuments({ type: 'REWARD_REDEMPTION' })).toBe(1);
    // 10 claimed, 1 earned on this same order.
    expect((await Customer.findById(customer._id))!.stats.currentVisits).toBe(1);
  });
});

describe('customer history', () => {
  it('is manager-only', async () => {
    const { customer, businessId } = await scenario();
    signInAs(businessId, 'STAFF');
    const res = await getHistory(
      jsonRequest(`/api/customers/${customer._id}/history`),
      routeParams({ customerId: String(customer._id) })
    );
    expect(res.status).toBe(401);
  });

  it('removing a purchase writes a reversal and keeps the original', async () => {
    const { customer, order } = await scenario();
    await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, {
        method: 'PATCH',
        body: { status: 'PAID', paymentMethod: 'CARD', customerId: String(customer._id) },
      }),
      routeParams({ orderId: String(order._id) })
    );
    const entry = await Visit.findOne({ type: 'ACCRUAL' });

    const res = await reverseEntry(
      jsonRequest(`/api/customers/${customer._id}/history`, {
        method: 'POST',
        body: { visitId: String(entry!._id) },
      }),
      routeParams({ customerId: String(customer._id) })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(2);
    expect((await Customer.findById(customer._id))!.stats.currentVisits).toBe(0);
  });

  it('refuses to reverse across businesses', async () => {
    const { customer, order } = await scenario();
    await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, {
        method: 'PATCH',
        body: { status: 'PAID', paymentMethod: 'CARD', customerId: String(customer._id) },
      }),
      routeParams({ orderId: String(order._id) })
    );
    const entry = await Visit.findOne({ type: 'ACCRUAL' });

    signInAs(oid(), 'OWNER');
    const res = await reverseEntry(
      jsonRequest(`/api/customers/${customer._id}/history`, {
        method: 'POST',
        body: { visitId: String(entry!._id) },
      }),
      routeParams({ customerId: String(customer._id) })
    );
    expect(res.status).toBe(400);
  });
});

describe('manual visit recording (dashboard, no POS)', () => {
  it('stamps by hand and reports the reward moment', async () => {
    const { customer } = await scenario(9);

    const res = await recordVisit(
      jsonRequest('/api/visits', { method: 'POST', body: { customerId: String(customer._id) } })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.earnedReward).toBe(true);
    expect(data.currentVisits).toBe(10);
    expect(await Visit.countDocuments({ type: 'ACCRUAL' })).toBe(1);
  });

  it('ignores the minimum-ticket guard — a manager doing this means it', async () => {
    const { businessId, customer } = await scenario(0);
    await Business.updateOne(
      { _id: businessId },
      { $set: { 'settings.loyalty.sellos.minTicket': 80 } }
    );

    const res = await recordVisit(
      jsonRequest('/api/visits', { method: 'POST', body: { customerId: String(customer._id) } })
    );

    expect((await res.json()).currentVisits).toBe(1);
  });

  it('is reversible like any other entry', async () => {
    const { customer } = await scenario(0);
    await recordVisit(
      jsonRequest('/api/visits', { method: 'POST', body: { customerId: String(customer._id) } })
    );
    const entry = await Visit.findOne({ type: 'ACCRUAL' });

    await reverseEntry(
      jsonRequest(`/api/customers/${customer._id}/history`, {
        method: 'POST',
        body: { visitId: String(entry!._id) },
      }),
      routeParams({ customerId: String(customer._id) })
    );

    expect((await Customer.findById(customer._id))!.stats.currentVisits).toBe(0);
  });
});
