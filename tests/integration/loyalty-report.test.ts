import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import Customer, { newPublicToken } from '@/models/Customer';
import Order from '@/models/Order';
import Visit from '@/models/Visit';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';
import { analyticsService } from '@/services/analytics.service';

vi.mock('@/lib/apple-push', () => ({
  sendAppleWalletPush: vi.fn(async () => {}),
  sendAppleWalletPushes: vi.fn(async () => []),
}));
vi.mock('@/lib/google-wallet', () => ({
  updateGoogleWalletObject: vi.fn(async () => {}),
  generateGoogleWalletUrl: vi.fn(() => 'https://pay.google.test/x'),
}));

import { GET as csv } from '@/app/api/reports/loyalty.csv/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

async function makeBusiness() {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: { loyalty: DEFAULT_LOYALTY },
  });
  return businessId;
}

async function customer(businessId: mongoose.Types.ObjectId, over: Record<string, unknown> = {}) {
  return Customer.create({
    name: 'Ana P.',
    phone: `55${Math.floor(Math.random() * 1e8)}`,
    businessId,
    stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
    publicToken: newPublicToken(),
    externalIds: { appleAuthToken: 'tok' },
    ...over,
  });
}

async function paidOrder(
  businessId: mongoose.Types.ObjectId,
  total: number,
  customerId?: mongoose.Types.ObjectId
) {
  return Order.create({
    businessId,
    tableId: oid(),
    tableName: 'Mesa 1',
    staffId: oid(),
    status: 'PAID',
    items: [{ productId: oid(), name: 'X', price: total, quantity: 1 }],
    total,
    closedAt: new Date(),
    customerId,
  });
}

describe('loyalty ROI report', () => {
  it('compares average ticket with and without a card', async () => {
    const businessId = await makeBusiness();
    const ana = await customer(businessId);

    await paidOrder(businessId, 400, ana._id as mongoose.Types.ObjectId);
    await paidOrder(businessId, 424, ana._id as mongoose.Types.ObjectId);
    await paidOrder(businessId, 300);
    await paidOrder(businessId, 274);

    const r = await analyticsService.getLoyaltyReport(String(businessId), 'month');

    expect(r.avgWithCard).toBe(412);
    expect(r.avgAnonymous).toBe(287);
    // The headline number: card-carrying customers spend ~44% more.
    expect(Math.round(r.uplift * 100)).toBe(44);
    expect(r.attachRate).toBe(0.5);
  });

  it('reports zeroes rather than dividing by zero on an empty period', async () => {
    const businessId = await makeBusiness();
    const r = await analyticsService.getLoyaltyReport(String(businessId), 'month');

    expect(r.avgWithCard).toBe(0);
    expect(r.uplift).toBe(0);
    expect(r.attachRate).toBe(0);
    expect(r.returnRate).toBe(0);
  });

  it('counts rewards actually delivered, not earned', async () => {
    const businessId = await makeBusiness();
    const ana = await customer(businessId);

    // Ten stamps earned...
    for (let i = 0; i < 10; i++) {
      await Visit.create({
        customerId: ana._id, businessId, employeeId: oid(),
        type: 'ACCRUAL', mechanic: 'sellos', delta: 1,
      });
    }
    let r = await analyticsService.getLoyaltyReport(String(businessId), 'month');
    expect(r.rewardsDelivered).toBe(0);

    // ...and only now handed over.
    await Visit.create({
      customerId: ana._id, businessId, employeeId: oid(),
      type: 'REWARD_REDEMPTION', mechanic: 'sellos', delta: -10,
    });
    r = await analyticsService.getLoyaltyReport(String(businessId), 'month');
    expect(r.rewardsDelivered).toBe(1);
  });

  it('counts a customer as returning only across separate days', async () => {
    const businessId = await makeBusiness();
    const twice = await customer(businessId);
    const once = await customer(businessId);
    const yesterday = new Date(Date.now() - 86_400_000);

    await Visit.create({ customerId: twice._id, businessId, employeeId: oid(), type: 'ACCRUAL', mechanic: 'sellos', delta: 1, createdAt: yesterday });
    await Visit.create({ customerId: twice._id, businessId, employeeId: oid(), type: 'ACCRUAL', mechanic: 'sellos', delta: 1 });
    // Two visits on the SAME day is one trip, not a return.
    await Visit.create({ customerId: once._id, businessId, employeeId: oid(), type: 'ACCRUAL', mechanic: 'sellos', delta: 1 });
    await Visit.create({ customerId: once._id, businessId, employeeId: oid(), type: 'ACCRUAL', mechanic: 'sellos', delta: 1 });

    const r = await analyticsService.getLoyaltyReport(String(businessId), 'month');
    expect(r.activeCustomers).toBe(2);
    expect(r.returnRate).toBe(0.5);
  });

  it('surfaces the outstanding cashback liability', async () => {
    const businessId = await makeBusiness();
    await customer(businessId, { stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 128.5 } });
    await customer(businessId, { stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 71.5 } });

    const r = await analyticsService.getLoyaltyReport(String(businessId), 'month');
    expect(r.cashbackLiability).toBe(200);
  });

  it('never counts another business', async () => {
    const businessId = await makeBusiness();
    const other = await makeBusiness();
    const theirs = await customer(other);
    await paidOrder(other, 999, theirs._id as mongoose.Types.ObjectId);

    const r = await analyticsService.getLoyaltyReport(String(businessId), 'month');
    expect(r.ordersWithCard).toBe(0);
    expect(r.totalCustomers).toBe(0);
  });
});

describe('CSV export', () => {
  it('is manager-only', async () => {
    const businessId = await makeBusiness();
    signInAs(businessId, 'STAFF');
    expect((await csv(jsonRequest('/api/reports/loyalty.csv'))).status).toBe(401);
  });

  it('downloads a summary plus one row per customer', async () => {
    const businessId = await makeBusiness();
    await customer(businessId, { name: 'Ana P.', stats: { totalVisits: 12, currentVisits: 3, cashbackBalance: 0 } });
    signInAs(businessId, 'OWNER');

    const res = await csv(jsonRequest('/api/reports/loyalty.csv?period=month'));
    // Read bytes, not text(): the fetch spec strips a leading BOM when decoding,
    // so text() can't tell you whether one was actually sent.
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    const body = await res.text();

    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(body).toContain('RESUMEN');
    expect(body).toContain('CLIENTES');
    expect(body).toContain('Ana P.');
    // BOM so Excel in es-MX renders the accents instead of mojibake.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('neutralises a name that would execute as a formula', async () => {
    const businessId = await makeBusiness();
    await customer(businessId, { name: '=HYPERLINK("http://evil.test")' });
    signInAs(businessId, 'OWNER');

    const body = await (await csv(jsonRequest('/api/reports/loyalty.csv'))).text();
    expect(body).toContain(`"'=HYPERLINK`);
  });
});
