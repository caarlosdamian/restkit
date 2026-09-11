import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import Customer, { newPublicToken } from '@/models/Customer';
import Visit from '@/models/Visit';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';

// No network from the wallet sync.
vi.mock('@/lib/apple-push', () => ({
  sendAppleWalletPush: vi.fn(async () => {}),
  sendAppleWalletPushes: vi.fn(async () => []),
}));
vi.mock('@/lib/google-wallet', () => ({
  updateGoogleWalletObject: vi.fn(async () => {}),
  generateGoogleWalletUrl: vi.fn(() => 'https://pay.google.test/x'),
}));

import { loyaltyService } from '@/services/loyalty.service';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const businessId = () => oid();

async function seed(
  loyalty: Partial<typeof DEFAULT_LOYALTY> = {},
  stats: Partial<{ totalVisits: number; currentVisits: number; cashbackBalance: number }> = {}
) {
  const bId = businessId();
  await Business.create({
    _id: bId,
    name: 'Café Luna',
    slug: `luna-${bId}`,
    settings: { loyalty: { ...DEFAULT_LOYALTY, ...loyalty } },
  });
  const customer = await Customer.create({
    name: 'Ana P.',
    phone: '5512345678',
    businessId: bId,
    stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0, ...stats },
    publicToken: newPublicToken(),
    externalIds: { appleAuthToken: 'tok' },
  });
  return { bId, customer, employeeId: oid() };
}

describe('accrual', () => {
  it('grants a stamp when an order is paid', async () => {
    const { bId, customer, employeeId } = await seed();

    const res = await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 340,
      tableName: 'Mesa 4',
    });

    expect(res?.earned).toBe(true);
    expect(res?.currentVisits).toBe(1);

    const fresh = await Customer.findById(customer._id);
    expect(fresh!.stats.currentVisits).toBe(1);
    expect(fresh!.stats.totalVisits).toBe(1);

    const entries = await Visit.find({ customerId: customer._id });
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('ACCRUAL');
    expect(entries[0].delta).toBe(1);
    expect(entries[0].tableName).toBe('Mesa 4');
  });

  it('is idempotent per order — a retried PATCH does not double-stamp', async () => {
    const { bId, customer, employeeId } = await seed();
    const orderId = oid();
    const args = {
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId,
      orderTotal: 340,
    };

    await loyaltyService.accrueForOrder(args);
    const second = await loyaltyService.accrueForOrder(args);

    expect(second).toBeNull();
    expect((await Customer.findById(customer._id))!.stats.currentVisits).toBe(1);
    expect(await Visit.countDocuments({ orderId, type: 'ACCRUAL' })).toBe(1);
  });

  it('flags the accrual that completes a card', async () => {
    const { bId, customer, employeeId } = await seed({}, { currentVisits: 9 });

    const res = await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 100,
    });

    expect(res?.justEarnedReward).toBe(true);
    expect(res?.rewardsPending).toBe(1);
    // The counter does NOT silently reset — that only happens on redemption.
    expect(res?.currentVisits).toBe(10);
  });

  it('accrues a percentage under cashback', async () => {
    const { bId, customer, employeeId } = await seed({ mechanic: 'cashback' });

    const res = await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 340,
    });

    expect(res?.mechanic).toBe('cashback');
    expect(res?.cashbackBalance).toBe(17);
  });
});

describe('reward redemption', () => {
  it('writes the REWARD_REDEMPTION nothing else ever wrote, and resets', async () => {
    const { bId, customer, employeeId } = await seed({}, { currentVisits: 10 });

    const res = await loyaltyService.redeemReward({
      customerId: String(customer._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    });

    expect(res.currentVisits).toBe(0);
    expect(res.rewardsPending).toBe(0);

    // This is what /dashboard/loyalty's "Premios entregados" counts. Before
    // this existed the tile showed a hardcoded zero for every business.
    expect(await Visit.countDocuments({ businessId: bId, type: 'REWARD_REDEMPTION' })).toBe(1);
  });

  it('refuses when no reward is pending', async () => {
    const { bId, customer, employeeId } = await seed({}, { currentVisits: 4 });
    await expect(
      loyaltyService.redeemReward({
        customerId: String(customer._id),
        businessId: String(bId),
        employeeId: String(employeeId),
      })
    ).rejects.toThrow(/no tiene un premio/i);
  });

  it('leaves surplus stamps on the card', async () => {
    const { bId, customer, employeeId } = await seed({}, { currentVisits: 13 });
    const res = await loyaltyService.redeemReward({
      customerId: String(customer._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    });
    expect(res.currentVisits).toBe(3);
  });
});

describe('cashback redemption', () => {
  it('applies up to the balance and deducts it', async () => {
    const { bId, customer, employeeId } = await seed(
      { mechanic: 'cashback' },
      { cashbackBalance: 128 }
    );

    const applied = await loyaltyService.redeemCashback({
      customerId: String(customer._id),
      businessId: String(bId),
      employeeId: String(employeeId),
      orderTotal: 340,
      requested: 128,
    });

    expect(applied).toBe(128);
    expect((await Customer.findById(customer._id))!.stats.cashbackBalance).toBe(0);
  });

  it('applies nothing below the threshold', async () => {
    const { bId, customer, employeeId } = await seed(
      { mechanic: 'cashback' },
      { cashbackBalance: 87 }
    );

    const applied = await loyaltyService.redeemCashback({
      customerId: String(customer._id),
      businessId: String(bId),
      employeeId: String(employeeId),
      orderTotal: 340,
      requested: 87,
    });

    expect(applied).toBe(0);
    expect((await Customer.findById(customer._id))!.stats.cashbackBalance).toBe(87);
  });
});

describe('reversal', () => {
  it('compensates instead of deleting', async () => {
    const { bId, customer, employeeId } = await seed();
    await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 340,
    });
    const entry = await Visit.findOne({ customerId: customer._id, type: 'ACCRUAL' });

    await loyaltyService.reverse({
      visitId: String(entry!._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    });

    const fresh = await Customer.findById(customer._id);
    expect(fresh!.stats.currentVisits).toBe(0);
    expect(fresh!.stats.totalVisits).toBe(0);

    // The original is still there — the history has to explain the number.
    expect(await Visit.countDocuments({ customerId: customer._id })).toBe(2);
    const reversal = await Visit.findOne({ type: 'REVERSAL' });
    expect(reversal!.delta).toBe(-1);
    expect(String(reversal!.reversesVisitId)).toBe(String(entry!._id));
  });

  it('never claws back a delivered reward', async () => {
    const { bId, customer, employeeId } = await seed({}, { currentVisits: 10 });
    await loyaltyService.redeemReward({
      customerId: String(customer._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    });
    const redemption = await Visit.findOne({ type: 'REWARD_REDEMPTION' });

    await expect(
      loyaltyService.reverse({
        visitId: String(redemption!._id),
        businessId: String(bId),
        employeeId: String(employeeId),
      })
    ).rejects.toThrow(/ya entregado/i);
  });

  it('returns cashback balance without touching the order or the cash-up', async () => {
    const { bId, customer, employeeId } = await seed(
      { mechanic: 'cashback' },
      { cashbackBalance: 128 }
    );
    const orderId = oid();
    await loyaltyService.redeemCashback({
      customerId: String(customer._id),
      businessId: String(bId),
      employeeId: String(employeeId),
      orderTotal: 340,
      requested: 128,
      orderId,
    });
    const redemption = await Visit.findOne({ type: 'REWARD_REDEMPTION', mechanic: 'cashback' });

    await loyaltyService.reverse({
      visitId: String(redemption!._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    });

    // Balance comes back to the customer...
    expect((await Customer.findById(customer._id))!.stats.cashbackBalance).toBe(128);
    // ...and the business eats the discount. Nothing rewrites that shift.
    const reversal = await Visit.findOne({ type: 'REVERSAL' });
    expect(reversal!.delta).toBe(128);
  });

  it('cannot be applied twice', async () => {
    const { bId, customer, employeeId } = await seed();
    await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 100,
    });
    const entry = await Visit.findOne({ type: 'ACCRUAL' });
    const args = {
      visitId: String(entry!._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    };

    await loyaltyService.reverse(args);
    await expect(loyaltyService.reverse(args)).rejects.toThrow(/ya fue revertido/i);
  });

  it('floors the counter at zero rather than going negative', async () => {
    const { bId, customer, employeeId } = await seed();
    await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 100,
    });
    // Drop the counter behind the ledger's back, as a manual correction might.
    await Customer.updateOne({ _id: customer._id }, { $set: { 'stats.currentVisits': 0 } });

    const entry = await Visit.findOne({ type: 'ACCRUAL' });
    await loyaltyService.reverse({
      visitId: String(entry!._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    });

    expect((await Customer.findById(customer._id))!.stats.currentVisits).toBe(0);
  });

  it('is scoped to the business', async () => {
    const { customer, employeeId, bId } = await seed();
    await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 100,
    });
    const entry = await Visit.findOne({ type: 'ACCRUAL' });

    await expect(
      loyaltyService.reverse({
        visitId: String(entry!._id),
        businessId: String(new mongoose.Types.ObjectId()),
        employeeId: String(employeeId),
      })
    ).rejects.toThrow(/no encontrado/i);
  });
});

describe('history', () => {
  it('pages ten at a time, newest first', async () => {
    const { bId, customer, employeeId } = await seed();
    for (let i = 0; i < 13; i++) {
      await loyaltyService.accrueForOrder({
        customerId: String(customer._id),
        businessId: bId,
        employeeId,
        orderId: oid(),
        orderTotal: 100 + i,
      });
    }

    const first = await loyaltyService.history(String(customer._id), String(bId), 0, 10);
    expect(first.entries).toHaveLength(10);
    expect(first.total).toBe(13);
    expect(first.hasMore).toBe(true);

    const second = await loyaltyService.history(String(customer._id), String(bId), 1, 10);
    expect(second.entries).toHaveLength(3);
    expect(second.hasMore).toBe(false);
  });

  it('marks entries that already carry a reversal', async () => {
    const { bId, customer, employeeId } = await seed();
    await loyaltyService.accrueForOrder({
      customerId: String(customer._id),
      businessId: bId,
      employeeId,
      orderId: oid(),
      orderTotal: 100,
    });
    const entry = await Visit.findOne({ type: 'ACCRUAL' });
    await loyaltyService.reverse({
      visitId: String(entry!._id),
      businessId: String(bId),
      employeeId: String(employeeId),
    });

    const history = await loyaltyService.history(String(customer._id), String(bId));
    const original = history.entries.find((e) => e.type === 'ACCRUAL');
    expect(original!.reversed).toBe(true);
  });
});
