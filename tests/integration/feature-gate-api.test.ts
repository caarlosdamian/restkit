import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, oid } from '../helpers/fixtures';
import { GET as listItems, POST as createItem } from '@/app/api/inventory/route';
import { PATCH as patchItem, DELETE as deleteItem } from '@/app/api/inventory/[itemId]/route';
import {
  GET as listMovements,
  POST as createMovement,
} from '@/app/api/inventory/[itemId]/movements/route';
import { GET as kitchenFeed } from '@/app/api/pos/kitchen/route';
import { PATCH as bump } from '@/app/api/pos/kitchen/[orderId]/bump/route';
import { GET as listProducts } from '@/app/api/products/route';
import { POST as startSession } from '@/app/api/pos-session/start/route';
import Business from '@/models/Business';
import InventoryItem from '@/models/InventoryItem';
import Order from '@/models/Order';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

const IN_20_DAYS = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
const DAYS_AGO_2 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

/** A business with a given subscription shape; returns its _id for signInAs. */
async function makeBusiness(
  subscription: Record<string, unknown>
): Promise<mongoose.Types.ObjectId> {
  const biz = await Business.create({
    name: 'Tier Test',
    slug: `tier-${oid().toString()}`,
    settings: { requiredVisits: 10, rewardDescription: 'x' },
    subscription,
  });
  return biz._id;
}

/** Purchased plan: both Stripe ids present, in good standing. */
const purchased = (plan: 'lite' | 'basic' | 'pro') => ({
  plan,
  billingPeriod: 'monthly',
  status: 'active',
  stripeCustomerId: 'cus_tier',
  stripeSubscriptionId: 'sub_tier',
  currentPeriodEnd: IN_20_DAYS,
});

/** Seed one inventory item + one in-kitchen order for the business, so the
 *  per-resource handlers have something real to hit. */
async function seedResources(businessId: mongoose.Types.ObjectId) {
  const item = await InventoryItem.create({
    businessId,
    name: 'Tortillas',
    unit: 'kg',
    quantity: 10,
    lowStockThreshold: 2,
    category: 'General',
  });
  const order = await Order.create({
    businessId,
    tableId: oid(),
    tableName: 'Mesa 1',
    staffId: oid(),
    status: 'IN_KITCHEN',
    items: [{ productId: oid(), name: 'Tacos', price: 50, quantity: 2, preparedQty: 0 }],
    total: 100,
  });
  return { itemId: item._id, orderId: order._id };
}

/** Run every gated handler and return their statuses, keyed by handler. */
async function hitAllGatedHandlers(ids: {
  itemId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
}) {
  const itemId = ids.itemId.toString();
  return {
    'inventory list': (await listItems()).status,
    'inventory create': (
      await createItem(jsonRequest('/api/inventory', { method: 'POST', body: { name: 'Café' } }))
    ).status,
    'inventory edit': (
      await patchItem(
        jsonRequest(`/api/inventory/${itemId}`, { method: 'PATCH', body: { name: 'Maíz' } }),
        routeParams({ itemId })
      )
    ).status,
    'inventory delete': (
      await deleteItem(
        jsonRequest(`/api/inventory/${itemId}`, { method: 'DELETE' }),
        routeParams({ itemId })
      )
    ).status,
    'movements list': (
      await listMovements(
        jsonRequest(`/api/inventory/${itemId}/movements`),
        routeParams({ itemId })
      )
    ).status,
    'movements create': (
      await createMovement(
        jsonRequest(`/api/inventory/${itemId}/movements`, {
          method: 'POST',
          body: { type: 'RESTOCK', delta: 5 },
        }),
        routeParams({ itemId })
      )
    ).status,
    'kds feed': (await kitchenFeed()).status,
    'kds bump': (
      await bump(
        jsonRequest(`/api/pos/kitchen/${ids.orderId}/bump`, {
          method: 'PATCH',
          body: { all: true },
        }),
        routeParams({ orderId: ids.orderId.toString() })
      )
    ).status,
  };
}

const HANDLERS = [
  'inventory list',
  'inventory create',
  'inventory edit',
  'inventory delete',
  'movements list',
  'movements create',
  'kds feed',
  'kds bump',
] as const;

describe('tier matrix — every gated handler × every subscription state', () => {
  it('purchased Básico: ALL gated handlers 403 with the upgrade code', async () => {
    const businessId = await makeBusiness(purchased('basic'));
    const ids = await seedResources(businessId);
    signInAs(businessId, 'OWNER');

    const statuses = await hitAllGatedHandlers(ids);
    for (const h of HANDLERS) expect(statuses[h], h).toBe(403);

    // and the 403 body carries the machine-readable upgrade code
    const res = await listItems();
    expect(await res.json()).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED', feature: 'inventory' });
  });

  it('purchased Profesional: ALL gated handlers succeed', async () => {
    const businessId = await makeBusiness(purchased('pro'));
    const ids = await seedResources(businessId);
    signInAs(businessId, 'OWNER');

    const statuses = await hitAllGatedHandlers(ids);
    for (const h of HANDLERS) expect(statuses[h], h).toBeLessThan(300);
  });

  it('purchased Lite: ALL gated handlers 403 with the upgrade code', async () => {
    const businessId = await makeBusiness(purchased('lite'));
    const ids = await seedResources(businessId);
    signInAs(businessId, 'OWNER');

    const statuses = await hitAllGatedHandlers(ids);
    for (const h of HANDLERS) expect(statuses[h], h).toBe(403);
  });

  it('bare free trial (nothing purchased): ALL gated handlers succeed', async () => {
    const businessId = await makeBusiness({
      plan: 'basic',
      status: 'trialing',
      trialEndsAt: IN_20_DAYS,
    });
    const ids = await seedResources(businessId);
    signInAs(businessId, 'OWNER');

    const statuses = await hitAllGatedHandlers(ids);
    for (const h of HANDLERS) expect(statuses[h], h).toBeLessThan(300);
  });

  it('trial with abandoned checkout (customer id, NO subscription id) is still a free trial', async () => {
    const businessId = await makeBusiness({
      plan: 'basic',
      status: 'trialing',
      trialEndsAt: IN_20_DAYS,
      stripeCustomerId: 'cus_abandoned',
    });
    const ids = await seedResources(businessId);
    signInAs(businessId, 'OWNER');

    const statuses = await hitAllGatedHandlers(ids);
    for (const h of HANDLERS) expect(statuses[h], h).toBeLessThan(300);
  });

  it('purchased Básico still inside a Stripe trial is already tier-gated', async () => {
    const businessId = await makeBusiness({
      plan: 'basic',
      status: 'trialing',
      trialEndsAt: IN_20_DAYS,
      stripeCustomerId: 'cus_tier',
      stripeSubscriptionId: 'sub_tier',
    });
    const ids = await seedResources(businessId);
    signInAs(businessId, 'OWNER');

    const statuses = await hitAllGatedHandlers(ids);
    for (const h of HANDLERS) expect(statuses[h], h).toBe(403);
  });

  it('grandfathered business (no subscription data): ALL gated handlers succeed', async () => {
    const businessId = await makeBusiness({});
    const ids = await seedResources(businessId);
    signInAs(businessId, 'OWNER');

    const statuses = await hitAllGatedHandlers(ids);
    for (const h of HANDLERS) expect(statuses[h], h).toBeLessThan(300);
  });
});

describe('tier gate boundaries — what it must NOT affect', () => {
  it('purchased Básico keeps full access to non-gated features (products, register)', async () => {
    const businessId = await makeBusiness(purchased('basic'));
    signInAs(businessId, 'OWNER');

    // Menu still works…
    expect((await listProducts()).status).toBe(200);
    // …and so does opening the cash register (POS starts at Básico).
    const res = await startSession(
      jsonRequest('/api/pos-session/start', { method: 'POST', body: { openingBalance: 500 } })
    );
    expect(res.status).toBe(201);
  });

  it('purchased Lite: menu still works but the register requires an upgrade', async () => {
    const businessId = await makeBusiness(purchased('lite'));
    signInAs(businessId, 'OWNER');

    // Menu (a non-gated feature) still works…
    expect((await listProducts()).status).toBe(200);
    // …but Lite doesn't include POS.
    const res = await startSession(
      jsonRequest('/api/pos-session/start', { method: 'POST', body: { openingBalance: 500 } })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED', feature: 'pos' });
  });

  it('expired trial: the access gate (402) still wins over tier logic', async () => {
    const businessId = await makeBusiness({
      plan: 'pro', // even on the best plan…
      status: 'trialing',
      trialEndsAt: DAYS_AGO_2, // …an expired, unpaid trial blocks the register
    });
    signInAs(businessId, 'OWNER');

    const res = await startSession(
      jsonRequest('/api/pos-session/start', { method: 'POST', body: { openingBalance: 500 } })
    );
    expect(res.status).toBe(402);
  });
});
