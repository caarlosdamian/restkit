import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, oid } from '../helpers/fixtures';
import { GET as listTables, POST as createTable } from '@/app/api/tables/route';
import { PATCH as patchTable, DELETE as deleteTable } from '@/app/api/tables/[tableId]/route';
import { PATCH as patchOccupancy } from '@/app/api/pos/tables/[tableId]/occupancy/route';
import Table from '@/models/Table';
import Order from '@/models/Order';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

describe('GET /api/tables', () => {
  it('401s without a session', async () => {
    expect((await listTables()).status).toBe(401);
  });

  it('returns active tables with their active order attached', async () => {
    const businessId = oid();
    signInAs(businessId);
    const t1 = await Table.create({ businessId, number: 1 });
    const t2 = await Table.create({ businessId, number: 2 });
    await Table.create({ businessId, number: 3, isActive: false });
    await Table.create({ businessId: oid(), number: 1 });

    await Order.create({
      businessId, tableId: t1._id, tableName: 'Mesa 1', staffId: oid(), status: 'OPEN', total: 80,
      items: [{ productId: oid(), name: 'Tacos', price: 40, quantity: 2 }],
    });
    await Order.create({
      businessId, tableId: t2._id, tableName: 'Mesa 2', staffId: oid(), status: 'PAID', total: 50,
      items: [{ productId: oid(), name: 'Agua', price: 50, quantity: 1 }],
    });

    const tables = await (await listTables()).json();
    expect(tables).toHaveLength(2); // inactive + foreign excluded
    const withOrder = tables.find((t: { number: number }) => t.number === 1);
    const withoutOrder = tables.find((t: { number: number }) => t.number === 2);
    expect(withOrder.activeOrder.total).toBe(80);
    expect(withoutOrder.activeOrder).toBeUndefined(); // PAID doesn't count as active
  });
});

describe('POST /api/tables', () => {
  it('is manager-only', async () => {
    signInAs(oid(), 'STAFF');
    const res = await createTable(jsonRequest('/api/tables', { method: 'POST', body: { number: 1 } }));
    expect(res.status).toBe(401);
  });

  it('creates with default name and capacity, 400s without a number', async () => {
    signInAs(oid(), 'OWNER');
    expect(
      (await createTable(jsonRequest('/api/tables', { method: 'POST', body: {} }))).status
    ).toBe(400);

    const res = await createTable(
      jsonRequest('/api/tables', { method: 'POST', body: { number: 12 } })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: 'Mesa 12', capacity: 4, isActive: true });
  });

  it('accepts an optional section', async () => {
    signInAs(oid(), 'OWNER');
    const res = await createTable(
      jsonRequest('/api/tables', { method: 'POST', body: { number: 3, section: 'Terraza' } })
    );
    expect(await res.json()).toMatchObject({ section: 'Terraza' });
  });

  it('409s on a duplicate table number for the same business (never a raw 500)', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await Table.create({ businessId, number: 7 });

    const res = await createTable(
      jsonRequest('/api/tables', { method: 'POST', body: { number: 7 } })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/7/);
    expect(await Table.countDocuments({ businessId, number: 7 })).toBe(1);
  });

  it('the same table number is fine across different businesses', async () => {
    await Table.create({ businessId: oid(), number: 1 });
    signInAs(oid(), 'OWNER');
    const res = await createTable(
      jsonRequest('/api/tables', { method: 'POST', body: { number: 1 } })
    );
    expect(res.status).toBe(201);
  });
});

describe('PATCH/DELETE /api/tables/[tableId]', () => {
  it('updates own tables, 404s on another business', async () => {
    const businessId = oid();
    signInAs(businessId, 'ADMIN');
    const mine = await Table.create({ businessId, number: 1 });
    const foreign = await Table.create({ businessId: oid(), number: 1 });

    const ok = await patchTable(
      jsonRequest(`/api/tables/${mine._id}`, { method: 'PATCH', body: { name: 'Terraza 1' } }),
      routeParams({ tableId: mine._id.toString() })
    );
    expect(ok.status).toBe(200);
    expect((await Table.findById(mine._id))!.name).toBe('Terraza 1');

    const stolen = await patchTable(
      jsonRequest(`/api/tables/${foreign._id}`, { method: 'PATCH', body: { name: 'Robada' } }),
      routeParams({ tableId: foreign._id.toString() })
    );
    expect(stolen.status).toBe(404);
  });

  it('409s when editing a table to a number already used by another table', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await Table.create({ businessId, number: 1 });
    const mesa2 = await Table.create({ businessId, number: 2 });

    const res = await patchTable(
      jsonRequest(`/api/tables/${mesa2._id}`, { method: 'PATCH', body: { number: 1 } }),
      routeParams({ tableId: mesa2._id.toString() })
    );
    expect(res.status).toBe(409);
    expect((await Table.findById(mesa2._id))!.number).toBe(2); // unchanged
  });

  it('DELETE soft-deletes so the table survives for history', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    const table = await Table.create({ businessId, number: 5 });

    await deleteTable(
      jsonRequest(`/api/tables/${table._id}`, { method: 'DELETE' }),
      routeParams({ tableId: table._id.toString() })
    );

    const doc = await Table.findById(table._id);
    expect(doc).not.toBeNull();
    expect(doc!.isActive).toBe(false);
  });
});

describe('PATCH /api/pos/tables/[tableId]/occupancy', () => {
  const toggle = (tableId: string, isOccupied: unknown) =>
    patchOccupancy(
      jsonRequest(`/api/pos/tables/${tableId}/occupancy`, { method: 'PATCH', body: { isOccupied } }),
      routeParams({ tableId })
    );

  it('toggles the manual busy flag and only that flag', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await Table.create({ businessId, number: 1, name: 'Mesa 1', capacity: 6 });

    const res = await toggle(table._id.toString(), true);
    expect(await res.json()).toMatchObject({ isOccupied: true });

    const doc = (await Table.findById(table._id))!;
    expect(doc.isOccupied).toBe(true);
    expect(doc.name).toBe('Mesa 1');
    expect(doc.capacity).toBe(6);

    await toggle(table._id.toString(), false);
    expect((await Table.findById(table._id))!.isOccupied).toBe(false);
  });

  it('400s on a non-boolean payload and 404s cross-business', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await Table.create({ businessId, number: 1 });
    expect((await toggle(table._id.toString(), 'yes')).status).toBe(400);

    const foreign = await Table.create({ businessId: oid(), number: 1 });
    expect((await toggle(foreign._id.toString(), true)).status).toBe(404);
  });
});
