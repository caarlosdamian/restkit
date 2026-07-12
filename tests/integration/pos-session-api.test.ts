import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, oid } from '../helpers/fixtures';
import { POST as startSession } from '@/app/api/pos-session/start/route';
import { GET as currentSession } from '@/app/api/pos-session/current/route';
import { POST as closeSession } from '@/app/api/pos-session/close/route';
import Order from '@/models/Order';
import POSSession from '@/models/POSSession';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

const start = (openingBalance?: number) =>
  startSession(jsonRequest('/api/pos-session/start', { method: 'POST', body: { openingBalance } }));
const close = (closingBalance?: number, notes?: string) =>
  closeSession(jsonRequest('/api/pos-session/close', { method: 'POST', body: { closingBalance, notes } }));

function paidOrder(
  businessId: mongoose.Types.ObjectId,
  total: number,
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER'
) {
  return Order.create({
    businessId, tableId: oid(), tableName: 'Mesa', staffId: oid(),
    status: 'PAID', paymentMethod, total, closedAt: new Date(),
    items: [{ productId: oid(), name: 'Item', price: total, quantity: 1 }],
  });
}

describe('POST /api/pos-session/start', () => {
  it('is manager-only and requires an opening balance', async () => {
    expect((await start(500)).status).toBe(401); // no session

    signInAs(oid(), 'STAFF');
    expect((await start(500)).status).toBe(403);

    signInAs(oid(), 'ADMIN');
    expect((await start(undefined)).status).toBe(400);
  });

  it('opens one session per business, 409s on a second', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');

    expect((await start(500)).status).toBe(201);
    expect((await start(300)).status).toBe(409);

    const open = await POSSession.findOne({ businessId, status: 'OPEN' });
    expect(open!.openingBalance).toBe(500);
    expect(open!.expectedCash).toBe(500);
  });
});

describe('GET /api/pos-session/current', () => {
  it('returns null when no register is open', async () => {
    signInAs(oid());
    expect(await (await currentSession()).json()).toEqual({ session: null });
  });

  it('reports live sales rollups from PAID orders since the session started', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await start(500);

    await paidOrder(businessId, 100, 'CASH');
    await paidOrder(businessId, 50, 'CARD');
    await paidOrder(businessId, 25, 'TRANSFER');
    await paidOrder(oid(), 999, 'CASH'); // other business — excluded

    const { session } = await (await currentSession()).json();
    expect(session).toMatchObject({
      openingBalance: 500,
      totalSales: 175,
      totalOrders: 3,
      cashSales: 100,
      cardSales: 50,
      transferSales: 25,
    });
  });
});

describe('POST /api/pos-session/close', () => {
  it('is manager-only, 404s with no open session, requires a closing balance', async () => {
    signInAs(oid(), 'STAFF');
    expect((await close(600)).status).toBe(403);

    signInAs(oid(), 'OWNER');
    expect((await close(undefined)).status).toBe(400);
    expect((await close(600)).status).toBe(404);
  });

  it('computes the cash cut: expected cash counts only CASH sales', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await start(500);

    await paidOrder(businessId, 100, 'CASH');
    await paidOrder(businessId, 80, 'CASH');
    await paidOrder(businessId, 200, 'CARD');

    const res = await close(620, 'Corte de prueba');
    expect(res.status).toBe(200);
    const { cut } = await res.json();

    expect(cut).toMatchObject({
      openingBalance: 500,
      cashSales: 180,
      cardSales: 200,
      transferSales: 0,
      totalSales: 380,
      totalOrders: 3,
      expectedCash: 680, // 500 opening + 180 cash; card never enters the drawer
      actualCash: 620,
      variance: -60,
      varianceNote: 'Shortage',
    });

    const closed = await POSSession.findOne({ businessId });
    expect(closed!.status).toBe('CLOSED');
    expect(closed!.notes).toBe('Corte de prueba');

    // Register can be reopened after closing.
    expect((await start(300)).status).toBe(201);
  });

  it('reports Overage/Balanced variance notes', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    await start(100);
    const { cut } = await (await close(150)).json();
    expect(cut.variance).toBe(50);
    expect(cut.varianceNote).toBe('Overage');
  });
});
