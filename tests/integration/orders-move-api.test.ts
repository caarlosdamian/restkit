import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, oid } from '../helpers/fixtures';
import { POST as moveOrder } from '@/app/api/orders/[orderId]/move/route';
import Order from '@/models/Order';
import Table from '@/models/Table';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

async function setup() {
  const businessId = oid();
  signInAs(businessId, 'OWNER');
  const tableA = await Table.create({
    businessId, number: 1, name: 'Mesa 1', isOccupied: true, assignedStaffId: oid(),
  });
  const tableB = await Table.create({ businessId, number: 2, name: 'Terraza 2' });
  const order = await Order.create({
    businessId, tableId: tableA._id, tableName: 'Mesa 1', staffId: oid(), status: 'IN_KITCHEN',
    items: [{ productId: oid(), name: 'Tacos', price: 50, quantity: 2 }],
    total: 100,
  });
  return { businessId, tableA, tableB, order };
}

function move(orderId: mongoose.Types.ObjectId, tableId?: string) {
  return moveOrder(
    jsonRequest(`/api/orders/${orderId}/move`, { method: 'POST', body: { tableId } }),
    routeParams({ orderId: orderId.toString() })
  );
}

describe('POST /api/orders/[orderId]/move', () => {
  it('moves the order to the free table and frees the old one', async () => {
    const { tableA, tableB, order } = await setup();

    const res = await move(order._id, tableB._id.toString());
    expect(res.status).toBe(200);

    const moved = (await Order.findById(order._id))!;
    expect(moved.tableId.equals(tableB._id)).toBe(true);
    expect(moved.tableName).toBe('Terraza 2');
    expect(moved.status).toBe('IN_KITCHEN'); // status untouched

    const freed = (await Table.findById(tableA._id))!;
    expect(freed.isOccupied).toBe(false);
    expect(freed.assignedStaffId).toBeUndefined();
  });

  it('409s when the target table already has an active order', async () => {
    const { businessId, tableB, order } = await setup();
    await Order.create({
      businessId, tableId: tableB._id, tableName: 'Terraza 2', staffId: oid(), status: 'OPEN',
    });

    expect((await move(order._id, tableB._id.toString())).status).toBe(409);
  });

  it('is a no-op when moving to the same table', async () => {
    const { tableA, order } = await setup();
    const res = await move(order._id, tableA._id.toString());
    expect(res.status).toBe(200);
    // Old table must NOT be freed on a no-op.
    expect((await Table.findById(tableA._id))!.isOccupied).toBe(true);
  });

  it('404s for an inactive target table', async () => {
    const { businessId, order } = await setup();
    const dead = await Table.create({ businessId, number: 9, isActive: false });
    expect((await move(order._id, dead._id.toString())).status).toBe(404);
  });

  it('404s for a target table of another business', async () => {
    const { order } = await setup();
    const foreign = await Table.create({ businessId: oid(), number: 1 });
    expect((await move(order._id, foreign._id.toString())).status).toBe(404);
  });

  it('404s for a closed (PAID) order and 400s without tableId', async () => {
    const { tableB, order } = await setup();
    expect((await move(order._id, undefined)).status).toBe(400);

    await Order.updateOne({ _id: order._id }, { status: 'PAID' });
    expect((await move(order._id, tableB._id.toString())).status).toBe(404);
  });
});
