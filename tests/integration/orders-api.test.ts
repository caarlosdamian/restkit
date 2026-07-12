import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState, setRequestHeaders } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, oid } from '../helpers/fixtures';
import { GET as listOrders, POST as createOrder } from '@/app/api/orders/route';
import { GET as getOrder, PATCH as patchOrder } from '@/app/api/orders/[orderId]/route';
import { signWaiterToken, verifyWaiterToken } from '@/lib/waiter-token';
import Order from '@/models/Order';
import Table from '@/models/Table';
import Product from '@/models/Product';
import InventoryItem from '@/models/InventoryItem';
import InventoryMovement from '@/models/InventoryMovement';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

async function makeTable(businessId: mongoose.Types.ObjectId, number = 1) {
  return Table.create({ businessId, number, name: `Mesa ${number}` });
}

const item = (productId: mongoose.Types.ObjectId, quantity = 1, price = 50, name = 'Tacos') => ({
  productId: productId.toString(),
  name,
  price,
  quantity,
});

describe('POST /api/orders', () => {
  it('401s without a session, 400s without tableId', async () => {
    expect((await createOrder(jsonRequest('/api/orders', { method: 'POST', body: { tableId: 'x' } }))).status).toBe(401);

    signInAs(oid());
    expect((await createOrder(jsonRequest('/api/orders', { method: 'POST', body: {} }))).status).toBe(400);
  });

  it('404s for a table of another business', async () => {
    const foreignTable = await makeTable(oid());
    signInAs(oid());
    const res = await createOrder(
      jsonRequest('/api/orders', { method: 'POST', body: { tableId: foreignTable._id.toString() } })
    );
    expect(res.status).toBe(404);
  });

  it('creates an order attributed to the terminal user, with computed total', async () => {
    const businessId = oid();
    const user = signInAs(businessId, 'OWNER');
    const table = await makeTable(businessId);

    const res = await createOrder(
      jsonRequest('/api/orders', {
        method: 'POST',
        body: { tableId: table._id.toString(), items: [item(oid(), 2, 45), item(oid(), 1, 30)] },
      })
    );
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(order.total).toBe(120);
    expect(order.tableName).toBe('Mesa 1');
    expect(order.staffId).toBe(user.id);
    expect(order.items.every((i: { addedBy: string }) => i.addedBy === user.id)).toBe(true);
    expect(order.status).toBe('OPEN');
  });

  it('concurrent creates for the same table yield exactly one order (unique active index)', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await makeTable(businessId);
    // Make sure the unique partial index exists before racing the inserts.
    await Order.init();

    const body = { tableId: table._id.toString(), items: [item(oid())] };
    // Same race as two terminals (or a StrictMode double-mount) opening the
    // table at once: both pass the existence check, one insert must lose.
    const [a, b] = await Promise.all([
      createOrder(jsonRequest('/api/orders', { method: 'POST', body })),
      createOrder(jsonRequest('/api/orders', { method: 'POST', body })),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 201].sort());
    const [orderA, orderB] = await Promise.all([a.json(), b.json()]);
    expect(orderA._id).toBe(orderB._id); // both callers converge on one order
    expect(await Order.countDocuments({ businessId })).toBe(1);
  });

  it('returns the existing active order instead of creating a duplicate', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await makeTable(businessId);
    const body = { tableId: table._id.toString(), items: [item(oid())] };

    const first = await (await createOrder(jsonRequest('/api/orders', { method: 'POST', body }))).json();
    const again = await createOrder(jsonRequest('/api/orders', { method: 'POST', body }));
    expect(again.status).toBe(200);
    expect((await again.json())._id).toBe(first._id);
    expect(await Order.countDocuments({ businessId })).toBe(1);
  });

  it('can be created straight into the kitchen, stamping kitchenAt', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await makeTable(businessId);

    const res = await createOrder(
      jsonRequest('/api/orders', {
        method: 'POST',
        body: { tableId: table._id.toString(), items: [item(oid())], status: 'IN_KITCHEN' },
      })
    );
    const order = await res.json();
    expect(order.status).toBe('IN_KITCHEN');
    expect(order.kitchenAt).toBeTruthy();
  });

  it('attributes to the PIN waiter and refreshes the token in the response header', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    const table = await makeTable(businessId);
    const waiterId = oid().toString();
    const token = signWaiterToken(waiterId, 'Ana', businessId.toString());
    setRequestHeaders({ 'x-waiter-token': token });

    const res = await createOrder(
      jsonRequest('/api/orders', {
        method: 'POST',
        body: { tableId: table._id.toString(), items: [item(oid())] },
      })
    );
    const order = await res.json();
    expect(order.staffId).toBe(waiterId);
    expect(order.items[0].addedBy).toBe(waiterId);

    const refreshed = res.headers.get('x-waiter-token');
    expect(refreshed).toBeTruthy();
    expect(verifyWaiterToken(refreshed, businessId.toString())).toMatchObject({ staffId: waiterId });
  });

  it('ignores a waiter token signed for another business', async () => {
    const businessId = oid();
    const user = signInAs(businessId, 'OWNER');
    const table = await makeTable(businessId);
    setRequestHeaders({ 'x-waiter-token': signWaiterToken(oid().toString(), 'Intruso', oid().toString()) });

    const res = await createOrder(
      jsonRequest('/api/orders', {
        method: 'POST',
        body: { tableId: table._id.toString(), items: [item(oid())] },
      })
    );
    const order = await res.json();
    expect(order.staffId).toBe(user.id); // fell back to the terminal user
    expect(res.headers.get('x-waiter-token')).toBeNull();
  });
});

describe('GET /api/orders and /api/orders/[orderId]', () => {
  it('lists only active orders, filterable by table', async () => {
    const businessId = oid();
    signInAs(businessId);
    const t1 = await makeTable(businessId, 1);
    const t2 = await makeTable(businessId, 2);
    const staffId = oid();
    await Order.create({ businessId, tableId: t1._id, tableName: 'Mesa 1', staffId, status: 'OPEN' });
    await Order.create({ businessId, tableId: t2._id, tableName: 'Mesa 2', staffId, status: 'PAID' });

    const all = await (await listOrders(jsonRequest('/api/orders'))).json();
    expect(all).toHaveLength(1); // PAID is not active

    const byTable = await (
      await listOrders(jsonRequest(`/api/orders?tableId=${t2._id.toString()}`))
    ).json();
    expect(byTable).toHaveLength(0);
  });

  it('404s when fetching an order of another business', async () => {
    const order = await Order.create({
      businessId: oid(), tableId: oid(), tableName: 'Mesa X', staffId: oid(), status: 'OPEN',
    });
    signInAs(oid());
    const res = await getOrder(
      jsonRequest(`/api/orders/${order._id}`),
      routeParams({ orderId: order._id.toString() })
    );
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/orders/[orderId]', () => {
  it('replacing items preserves original addedBy and caps preparedQty at the new quantity', async () => {
    const businessId = oid();
    const manager = signInAs(businessId, 'OWNER');
    const table = await makeTable(businessId);
    const waiterA = oid();
    const p1 = oid();
    const p2 = oid();

    const order = await Order.create({
      businessId, tableId: table._id, tableName: 'Mesa 1', staffId: waiterA, status: 'IN_KITCHEN',
      items: [{ productId: p1, name: 'Tacos', price: 50, quantity: 3, addedBy: waiterA, preparedQty: 2 }],
      total: 150,
    });

    const res = await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, {
        method: 'PATCH',
        body: { items: [item(p1, 1, 50), item(p2, 2, 30, 'Agua')] },
      }),
      routeParams({ orderId: order._id.toString() })
    );
    expect(res.status).toBe(200);

    const updated = (await Order.findById(order._id))!;
    const line1 = updated.items.find((i) => i.productId.equals(p1))!;
    const line2 = updated.items.find((i) => i.productId.equals(p2))!;
    expect(line1.addedBy!.equals(waiterA)).toBe(true); // original waiter kept
    expect(line1.preparedQty).toBe(1); // capped at reduced quantity
    expect(line2.addedBy!.toString()).toBe(manager.id); // new line stamped with actor
    expect(line2.preparedQty).toBe(0);
    expect(updated.total).toBe(110);
  });

  it('stamps kitchenAt on the first IN_KITCHEN transition only', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await makeTable(businessId);
    const order = await Order.create({
      businessId, tableId: table._id, tableName: 'Mesa 1', staffId: oid(), status: 'OPEN',
    });

    const patch = (body: unknown) =>
      patchOrder(
        jsonRequest(`/api/orders/${order._id}`, { method: 'PATCH', body }),
        routeParams({ orderId: order._id.toString() })
      );

    await patch({ status: 'IN_KITCHEN' });
    const first = (await Order.findById(order._id))!.kitchenAt!;
    expect(first).toBeTruthy();

    await patch({ status: 'READY' });
    await patch({ status: 'IN_KITCHEN' }); // second round
    const second = (await Order.findById(order._id))!.kitchenAt!;
    expect(second.getTime()).toBe(first.getTime());
  });

  it('on PAID: assigns ticketNumber, computes change, frees the table, deducts inventory once', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await Table.create({
      businessId, number: 7, name: 'Mesa 7', isOccupied: true, assignedStaffId: oid(),
    });

    const carne = await InventoryItem.create({ businessId, name: 'Carne', unit: 'kg', quantity: 10 });
    const taco = await Product.create({
      businessId, name: 'Taco', price: 58, category: 'Tacos',
      recipe: [{ inventoryItemId: carne._id, quantity: 0.5 }],
    });

    const order = await Order.create({
      businessId, tableId: table._id, tableName: 'Mesa 7', staffId: oid(), status: 'READY',
      items: [{ productId: taco._id, name: 'Taco', price: 58, quantity: 2 }],
      total: 116,
    });

    const patch = () =>
      patchOrder(
        jsonRequest(`/api/orders/${order._id}`, {
          method: 'PATCH',
          body: { status: 'PAID', paymentMethod: 'CASH', amountReceived: 200 },
        }),
        routeParams({ orderId: order._id.toString() })
      );

    expect((await patch()).status).toBe(200);

    const paid = (await Order.findById(order._id))!;
    expect(paid.ticketNumber).toBe(order._id.toString().slice(-6).toUpperCase());
    expect(paid.change).toBe(84);
    expect(paid.closedAt).toBeTruthy();
    expect(paid.inventoryDeducted).toBe(true);

    const freedTable = (await Table.findById(table._id))!;
    expect(freedTable.isOccupied).toBe(false);
    expect(freedTable.assignedStaffId).toBeUndefined();

    expect((await InventoryItem.findById(carne._id))!.quantity).toBe(9); // 10 - 2*0.5

    // Retried PAID must not double-deduct.
    await patch();
    expect((await InventoryItem.findById(carne._id))!.quantity).toBe(9);
    expect(await InventoryMovement.countDocuments({ inventoryItemId: carne._id })).toBe(1);
  });

  it('change is never negative when received is short of the total', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await makeTable(businessId);
    const order = await Order.create({
      businessId, tableId: table._id, tableName: 'Mesa 1', staffId: oid(), status: 'READY',
      items: [{ productId: oid(), name: 'Tacos', price: 100, quantity: 1 }],
      total: 100,
    });

    await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, {
        method: 'PATCH',
        body: { status: 'PAID', paymentMethod: 'CASH', amountReceived: 80 },
      }),
      routeParams({ orderId: order._id.toString() })
    );
    expect((await Order.findById(order._id))!.change).toBe(0);
  });

  it('CANCELLED also frees the table and never touches inventory', async () => {
    const businessId = oid();
    signInAs(businessId);
    const table = await Table.create({ businessId, number: 3, isOccupied: true });
    const order = await Order.create({
      businessId, tableId: table._id, tableName: 'Mesa 3', staffId: oid(), status: 'OPEN',
      items: [{ productId: oid(), name: 'Tacos', price: 50, quantity: 1 }],
      total: 50,
    });

    await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, { method: 'PATCH', body: { status: 'CANCELLED' } }),
      routeParams({ orderId: order._id.toString() })
    );

    expect((await Order.findById(order._id))!.status).toBe('CANCELLED');
    expect((await Table.findById(table._id))!.isOccupied).toBe(false);
    expect(await InventoryMovement.countDocuments({ businessId })).toBe(0);
  });

  it('404s when patching an order of another business', async () => {
    const order = await Order.create({
      businessId: oid(), tableId: oid(), tableName: 'Mesa X', staffId: oid(), status: 'OPEN',
    });
    signInAs(oid());
    const res = await patchOrder(
      jsonRequest(`/api/orders/${order._id}`, { method: 'PATCH', body: { status: 'PAID' } }),
      routeParams({ orderId: order._id.toString() })
    );
    expect(res.status).toBe(404);
  });
});
