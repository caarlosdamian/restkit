import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, oid } from '../helpers/fixtures';
import { GET as kitchenFeed } from '@/app/api/pos/kitchen/route';
import { PATCH as bump } from '@/app/api/pos/kitchen/[orderId]/bump/route';
import Order, { OrderStatus } from '@/models/Order';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

function makeOrder(
  businessId: mongoose.Types.ObjectId,
  opts: {
    status?: OrderStatus;
    kitchenAt?: Date;
    items?: Array<{ productId: mongoose.Types.ObjectId; quantity: number; preparedQty?: number }>;
    tableName?: string;
  } = {}
) {
  return Order.create({
    businessId,
    tableId: oid(),
    tableName: opts.tableName ?? 'Mesa 1',
    staffId: oid(),
    status: opts.status ?? 'IN_KITCHEN',
    kitchenAt: opts.kitchenAt,
    items: (opts.items ?? [{ productId: oid(), quantity: 2 }]).map((i) => ({
      productId: i.productId,
      name: 'Tacos',
      price: 50,
      quantity: i.quantity,
      preparedQty: i.preparedQty ?? 0,
    })),
    total: 100,
  });
}

function bumpReq(orderId: mongoose.Types.ObjectId, body: unknown) {
  return bump(
    jsonRequest(`/api/pos/kitchen/${orderId}/bump`, { method: 'PATCH', body }),
    routeParams({ orderId: orderId.toString() })
  );
}

describe('GET /api/pos/kitchen (KDS feed)', () => {
  it('401s without a terminal session', async () => {
    expect((await kitchenFeed()).status).toBe(401);
  });

  it('returns only IN_KITCHEN tickets of this business, oldest first (FIFO)', async () => {
    const businessId = oid();
    signInAs(businessId, 'STAFF'); // any session role can read the feed

    const older = await makeOrder(businessId, { kitchenAt: new Date('2026-07-12T10:00:00Z'), tableName: 'Mesa 1' });
    const newer = await makeOrder(businessId, { kitchenAt: new Date('2026-07-12T10:05:00Z'), tableName: 'Mesa 2' });
    await makeOrder(businessId, { status: 'OPEN' });
    await makeOrder(businessId, { status: 'READY' });
    await makeOrder(oid(), { kitchenAt: new Date('2026-07-12T09:00:00Z') }); // other business

    const { tickets } = await (await kitchenFeed()).json();
    expect(tickets.map((t: { _id: string }) => t._id)).toEqual([
      older._id.toString(),
      newer._id.toString(),
    ]);
    expect(tickets[0].items[0]).toMatchObject({ name: 'Tacos', quantity: 2, preparedQty: 0 });
  });

  it('falls back to createdAt for legacy tickets without kitchenAt', async () => {
    const businessId = oid();
    signInAs(businessId);
    await makeOrder(businessId, {}); // no kitchenAt
    const { tickets } = await (await kitchenFeed()).json();
    expect(tickets[0].kitchenAt).toBeTruthy();
  });
});

describe('PATCH /api/pos/kitchen/[orderId]/bump', () => {
  it('bumping one of two lines keeps the ticket IN_KITCHEN', async () => {
    const businessId = oid();
    signInAs(businessId);
    const p1 = oid();
    const p2 = oid();
    const order = await makeOrder(businessId, {
      items: [{ productId: p1, quantity: 2 }, { productId: p2, quantity: 1 }],
    });

    const res = await bumpReq(order._id, { productId: p1.toString(), prepared: true });
    expect((await res.json()).status).toBe('IN_KITCHEN');

    const doc = (await Order.findById(order._id))!;
    expect(doc.items.find((i) => i.productId.equals(p1))!.preparedQty).toBe(2);
    expect(doc.items.find((i) => i.productId.equals(p2))!.preparedQty).toBe(0);
  });

  it('bumping the last pending line flips the ticket to READY', async () => {
    const businessId = oid();
    signInAs(businessId);
    const p1 = oid();
    const p2 = oid();
    const order = await makeOrder(businessId, {
      items: [{ productId: p1, quantity: 2, preparedQty: 2 }, { productId: p2, quantity: 1 }],
    });

    const res = await bumpReq(order._id, { productId: p2.toString(), prepared: true });
    expect((await res.json()).status).toBe('READY');
  });

  it('{ all: true } bumps the whole ticket to READY', async () => {
    const businessId = oid();
    signInAs(businessId);
    const order = await makeOrder(businessId, {
      items: [{ productId: oid(), quantity: 3 }, { productId: oid(), quantity: 1 }],
    });

    const res = await bumpReq(order._id, { all: true });
    expect((await res.json()).status).toBe('READY');
    const doc = (await Order.findById(order._id))!;
    expect(doc.items.every((i) => i.preparedQty === i.quantity)).toBe(true);
  });

  it('un-bumping a line on a READY ticket pulls it back to IN_KITCHEN', async () => {
    const businessId = oid();
    signInAs(businessId);
    const p1 = oid();
    const order = await makeOrder(businessId, {
      status: 'READY',
      items: [{ productId: p1, quantity: 2, preparedQty: 2 }],
    });

    const res = await bumpReq(order._id, { productId: p1.toString(), prepared: false });
    expect((await res.json()).status).toBe('IN_KITCHEN');
    expect((await Order.findById(order._id))!.items[0].preparedQty).toBe(0);
  });

  it('404s for unknown product line, closed orders, and other businesses', async () => {
    const businessId = oid();
    signInAs(businessId);
    const order = await makeOrder(businessId, {});

    expect((await bumpReq(order._id, { productId: oid().toString() })).status).toBe(404);
    expect((await bumpReq(order._id, {})).status).toBe(400);

    // An empty/aborted request body is a 400, never an unhandled 500.
    const emptyBody = await bump(
      jsonRequest(`/api/pos/kitchen/${order._id}/bump`, { method: 'PATCH' }),
      routeParams({ orderId: order._id.toString() })
    );
    expect(emptyBody.status).toBe(400);

    const paid = await makeOrder(businessId, { status: 'PAID' });
    expect((await bumpReq(paid._id, { all: true })).status).toBe(404);

    const foreign = await makeOrder(oid(), {});
    expect((await bumpReq(foreign._id, { all: true })).status).toBe(404);
  });
});
