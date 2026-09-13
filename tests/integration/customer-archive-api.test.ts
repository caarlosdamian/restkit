import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, oid } from '../helpers/fixtures';
import Business from '@/models/Business';
import Customer from '@/models/Customer';
import Visit from '@/models/Visit';
import { DEFAULT_LOYALTY } from '@/lib/loyalty';
import { customerService } from '@/services/customer.service';
import { analyticsService } from '@/services/analytics.service';

import { PATCH as patchCustomer, DELETE as deleteCustomer } from '@/app/api/customers/[customerId]/route';
import { GET as lookup } from '@/app/api/pos/customers/lookup/route';
import { GET as scanGet } from '@/app/api/loyalty/scan/[token]/route';

/**
 * "Eliminar cliente" archives rather than deletes, and that choice is only
 * worth anything if every surface honours it. A customer who is gone from the
 * dashboard but still attachable at the till is worse than no delete button at
 * all — the owner believes they removed someone who is still earning.
 *
 * So this checks the rule from both sides: the operational surfaces stop
 * finding them, and the ledger keeps explaining the numbers.
 */

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

async function seed(stats: Record<string, number> = {}) {
  const businessId = oid();
  await Business.create({
    _id: businessId,
    name: 'Café Luna',
    slug: `luna-${businessId}`,
    settings: { loyalty: { ...DEFAULT_LOYALTY, sellos: { ...DEFAULT_LOYALTY.sellos, required: 10 } } },
  });
  const customer = await Customer.create({
    businessId,
    name: 'Ana Sofía',
    phone: '5512340001',
    stats: { totalVisits: 3, currentVisits: 3, cashbackBalance: 0, ...stats },
    publicToken: `tok-${businessId}`,
    externalIds: { appleAuthToken: `auth-${businessId}` },
  });
  return { businessId, customer, customerId: String(customer._id) };
}

const archive = (customerId: string) =>
  deleteCustomer(jsonRequest(`/api/customers/${customerId}`, { method: 'DELETE' }), routeParams({ customerId }));

const restore = (customerId: string) =>
  patchCustomer(
    jsonRequest(`/api/customers/${customerId}`, { method: 'PATCH', body: { isActive: true } }),
    routeParams({ customerId })
  );

describe('archiving a customer', () => {
  it('takes them off the roster without touching their ledger', async () => {
    const { businessId, customerId } = await seed();
    await Visit.create({
      customerId,
      businessId,
      employeeId: oid(),
      type: 'ACCRUAL',
      mechanic: 'sellos',
      delta: 1,
    });
    signInAs(businessId, 'OWNER');

    expect((await archive(customerId)).status).toBe(200);

    // Gone from the dashboard list…
    expect(await customerService.getAllCustomers(String(businessId))).toHaveLength(0);
    // …but the row and every entry behind it are still there.
    const row = await Customer.findById(customerId);
    expect(row!.isActive).toBe(false);
    expect(row!.stats.totalVisits).toBe(3);
    expect(await Visit.countDocuments({ customerId })).toBe(1);
  });

  it('⚠️ stops them being attachable at the till', async () => {
    const { businessId, customerId } = await seed();
    signInAs(businessId, 'OWNER');

    const before = await lookup(jsonRequest('/api/pos/customers/lookup?phone=5512340001'));
    expect((await before.json()).results).toHaveLength(1);

    await archive(customerId);

    // The failure that would matter: a customer the owner believes is deleted,
    // still offered to a waiter at cobro and still earning.
    const after = await lookup(jsonRequest('/api/pos/customers/lookup?phone=5512340001'));
    expect((await after.json()).results).toHaveLength(0);
  });

  it('⚠️ makes their card unscannable, and says "not found" rather than "disabled"', async () => {
    const { businessId, customerId, customer } = await seed();
    signInAs(businessId, 'OWNER');
    const token = customer.publicToken;

    expect((await scanGet(jsonRequest(`/api/loyalty/scan/${token}`), routeParams({ token }))).status).toBe(200);

    await archive(customerId);

    // 404, exactly like a token from another business — confirming "this card
    // is real but switched off" is a lookup service for anyone holding a ticket.
    const res = await scanGet(jsonRequest(`/api/loyalty/scan/${token}`), routeParams({ token }));
    expect(res.status).toBe(404);
  });

  it('drops out of the live figures but leaves the visit history alone', async () => {
    const { businessId, customerId } = await seed({ cashbackBalance: 250 });
    signInAs(businessId, 'OWNER');

    const before = await analyticsService.getDashboardStats(String(businessId));
    expect(before.totalCustomers).toBe(1);

    await archive(customerId);

    const after = await analyticsService.getDashboardStats(String(businessId));
    expect(after.totalCustomers).toBe(0);

    // The balance is preserved on the row — archiving is not a write-off — but
    // nothing can spend it while they are out of the lookup, so it stops
    // counting as money owed today.
    expect((await Customer.findById(customerId))!.stats.cashbackBalance).toBe(250);
    const report = await analyticsService.getLoyaltyReport(String(businessId), 'month');
    expect(report.cashbackLiability).toBe(0);
  });

  it('restores them exactly as they were, balance included', async () => {
    const { businessId, customerId } = await seed({ cashbackBalance: 250 });
    signInAs(businessId, 'OWNER');

    await archive(customerId);
    expect((await restore(customerId)).status).toBe(200);

    const [listed] = await customerService.getAllCustomers(String(businessId));
    expect(listed).toBeTruthy();
    expect(listed.stats.cashbackBalance).toBe(250);

    const back = await lookup(jsonRequest('/api/pos/customers/lookup?phone=5512340001'));
    expect((await back.json()).results).toHaveLength(1);
  });

  it('lists archived customers only when they are asked for', async () => {
    const { businessId, customerId } = await seed();
    signInAs(businessId, 'OWNER');
    await archive(customerId);

    expect(await customerService.getAllCustomers(String(businessId))).toHaveLength(0);
    expect(await customerService.getAllCustomers(String(businessId), { archived: true })).toHaveLength(1);
  });

  it('counts a customer with no isActive field at all as active', async () => {
    // Every row predating this feature has no such field, and must not vanish
    // from the dashboard the moment it ships.
    const { businessId, customerId } = await seed();
    await Customer.collection.updateOne(
      { _id: (await Customer.findById(customerId))!._id },
      { $unset: { isActive: '' } }
    );

    expect(await customerService.getAllCustomers(String(businessId))).toHaveLength(1);
  });

  it('will not let one business archive another business customer', async () => {
    const { customerId } = await seed();
    signInAs(oid(), 'OWNER');

    expect((await archive(customerId)).status).toBe(404);
    expect((await Customer.findById(customerId))!.isActive).not.toBe(false);
  });

  it('refuses a waiter', async () => {
    const { businessId, customerId } = await seed();
    signInAs(businessId, 'STAFF');

    expect((await archive(customerId)).status).toBe(403);
    expect((await Customer.findById(customerId))!.isActive).not.toBe(false);
  });
});

describe('editing a customer', () => {
  it('reports a phone another customer already has as a conflict, not a crash', async () => {
    const { businessId, customerId } = await seed();
    await Customer.create({
      businessId,
      name: 'Otro Cliente',
      phone: '5599998888',
      stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
      publicToken: `tok2-${businessId}`,
      externalIds: { appleAuthToken: `auth2-${businessId}` },
    });
    signInAs(businessId, 'OWNER');

    const res = await patchCustomer(
      jsonRequest(`/api/customers/${customerId}`, { method: 'PATCH', body: { phone: '5599998888' } }),
      routeParams({ customerId })
    );
    const data = await res.json();

    // A 500 here reads as "the app is broken" and the owner retries forever.
    expect(res.status).toBe(409);
    expect(data.code).toBe('DUPLICATE_CONTACT');
    expect(data.error).toContain('teléfono');
  });

  it('saves an ordinary edit', async () => {
    const { businessId, customerId } = await seed();
    signInAs(businessId, 'OWNER');

    const res = await patchCustomer(
      jsonRequest(`/api/customers/${customerId}`, {
        method: 'PATCH',
        body: { name: 'Ana Sofía Ruiz', phone: '5512349999' },
      }),
      routeParams({ customerId })
    );

    expect(res.status).toBe(200);
    const row = await Customer.findById(customerId);
    expect(row!.name).toBe('Ana Sofía Ruiz');
    expect(row!.phone).toBe('5512349999');
  });
});
