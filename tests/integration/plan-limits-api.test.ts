import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import Table from '@/models/Table';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';

import { POST as createTable } from '@/app/api/tables/route';
import { POST as startSession } from '@/app/api/pos-session/start/route';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

/** `subscription` shapes: a PURCHASED plan carries a Stripe subscription id.
 *  A trial business has picked a plan at signup but paid for nothing. */
async function business(sub: Record<string, unknown>) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: { loyalty: DEFAULT_LOYALTY },
    subscription: sub,
  });
  return businessId;
}

const purchased = (plan: string) => ({
  plan,
  status: 'active',
  stripeSubscriptionId: 'sub_123',
  currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
});

const trialing = (plan: string) => ({
  plan,
  status: 'trialing',
  trialEndsAt: new Date(Date.now() + 10 * 86_400_000),
});

async function fillTables(businessId: mongoose.Types.ObjectId, n: number) {
  for (let i = 1; i <= n; i++) {
    await Table.create({ businessId, number: i, name: `Mesa ${i}`, capacity: 4 });
  }
}

const newTable = (number: number) =>
  jsonRequest('/api/tables', { method: 'POST', body: { number } });

describe('POS is no longer gated by tier', () => {
  it('lets a purchased Lite business open the register', async () => {
    // This is the point of the restructure: automatic loyalty at the register
    // is the differentiator, and it used to be locked out of Lite.
    const businessId = await business(purchased('lite'));
    signInAs(businessId, 'OWNER');

    const res = await startSession(
      jsonRequest('/api/pos-session/start', { method: 'POST', body: { openingBalance: 500 } })
    );

    // Used to be 403 PLAN_UPGRADE_REQUIRED for Lite.
    expect(res.status).toBe(201);
  });
});

describe('table capacity', () => {
  it('stops a purchased Lite business at its ceiling', async () => {
    const businessId = await business(purchased('lite'));
    await fillTables(businessId, 6);
    signInAs(businessId, 'OWNER');

    const res = await createTable(newTable(7));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('PLAN_LIMIT_REACHED');
    // The message names the number and the way out, rather than just refusing.
    expect(data.max).toBe(6);
    expect(data.error).toContain('6 mesas');
    expect(data.error).toContain('Mejora de plan');
  });

  it('allows the last table below the ceiling', async () => {
    const businessId = await business(purchased('lite'));
    await fillTables(businessId, 5);
    signInAs(businessId, 'OWNER');

    expect((await createTable(newTable(6))).status).toBe(201);
  });

  it('frees a slot when a table is soft-deleted', async () => {
    const businessId = await business(purchased('lite'));
    await fillTables(businessId, 6);
    await Table.updateOne({ businessId, number: 1 }, { $set: { isActive: false } });
    signInAs(businessId, 'OWNER');

    expect((await createTable(newTable(7))).status).toBe(201);
  });

  it('does not cap Básico or Profesional', async () => {
    for (const plan of ['basic', 'pro']) {
      await clearTestDb();
      resetAuthState();
      const businessId = await business(purchased(plan));
      await fillTables(businessId, 30);
      signInAs(businessId, 'OWNER');

      expect((await createTable(newTable(31))).status).toBe(201);
    }
  });
});

describe('who the ceiling applies to', () => {
  it('never caps a business still on the free trial', async () => {
    // They picked a plan at signup but have paid for nothing — capping the
    // trial would cripple the thing they are evaluating.
    const businessId = await business(trialing('lite'));
    await fillTables(businessId, 6);
    signInAs(businessId, 'OWNER');

    expect((await createTable(newTable(7))).status).toBe(201);
  });

  it('never caps a legacy business with no subscription record', async () => {
    const businessId = await business({});
    await fillTables(businessId, 20);
    signInAs(businessId, 'OWNER');

    expect((await createTable(newTable(21))).status).toBe(201);
  });

  it('still refuses a non-manager before it ever checks capacity', async () => {
    const businessId = await business(purchased('lite'));
    signInAs(businessId, 'STAFF');
    expect((await createTable(newTable(1))).status).toBe(401);
  });
});
