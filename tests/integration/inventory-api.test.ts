import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, oid } from '../helpers/fixtures';
import { GET as listItems, POST as createItem } from '@/app/api/inventory/route';
import { PATCH as patchItem, DELETE as deleteItem } from '@/app/api/inventory/[itemId]/route';
import {
  GET as listMovements,
  POST as createMovement,
} from '@/app/api/inventory/[itemId]/movements/route';
import InventoryItem from '@/models/InventoryItem';
import InventoryMovement from '@/models/InventoryMovement';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

describe('GET/POST /api/inventory', () => {
  it('returns 401 without a session', async () => {
    expect((await listItems()).status).toBe(401);
  });

  it('rejects item creation from STAFF (manager only)', async () => {
    signInAs(oid(), 'STAFF');
    const res = await createItem(jsonRequest('/api/inventory', { method: 'POST', body: { name: 'Café' } }));
    expect(res.status).toBe(401);
  });

  it('creates an item with sensible defaults and 400s without a name', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');

    const bad = await createItem(jsonRequest('/api/inventory', { method: 'POST', body: {} }));
    expect(bad.status).toBe(400);

    const res = await createItem(
      jsonRequest('/api/inventory', { method: 'POST', body: { name: 'Tortillas' } })
    );
    expect(res.status).toBe(201);
    const item = await res.json();
    expect(item).toMatchObject({ name: 'Tortillas', unit: 'unidad', category: 'General', quantity: 0 });
  });

  it('lists only active items of the caller business', async () => {
    const businessId = oid();
    await InventoryItem.create({ businessId, name: 'Mío', quantity: 1 });
    await InventoryItem.create({ businessId, name: 'Borrado', quantity: 1, isActive: false });
    await InventoryItem.create({ businessId: oid(), name: 'Ajeno', quantity: 1 });

    signInAs(businessId, 'STAFF'); // read is allowed for any session
    const items = await (await listItems()).json();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Mío');
  });
});

describe('PATCH/DELETE /api/inventory/[itemId]', () => {
  it('edits metadata but silently ignores quantity (stock only moves via movements)', async () => {
    const businessId = oid();
    signInAs(businessId, 'ADMIN');
    const item = await InventoryItem.create({ businessId, name: 'Café', quantity: 10 });

    const res = await patchItem(
      jsonRequest(`/api/inventory/${item._id}`, {
        method: 'PATCH',
        body: { name: 'Café de grano', quantity: 999, lowStockThreshold: 2 },
      }),
      routeParams({ itemId: item._id.toString() })
    );

    expect(res.status).toBe(200);
    const updated = await InventoryItem.findById(item._id);
    expect(updated!.name).toBe('Café de grano');
    expect(updated!.lowStockThreshold).toBe(2);
    expect(updated!.quantity).toBe(10); // untouched
  });

  it('404s when the item belongs to another business', async () => {
    const item = await InventoryItem.create({ businessId: oid(), name: 'Ajeno', quantity: 1 });
    signInAs(oid(), 'OWNER');
    const res = await patchItem(
      jsonRequest(`/api/inventory/${item._id}`, { method: 'PATCH', body: { name: 'Robado' } }),
      routeParams({ itemId: item._id.toString() })
    );
    expect(res.status).toBe(404);
  });

  it('soft-deletes (isActive=false), keeping the document', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');
    const item = await InventoryItem.create({ businessId, name: 'Viejo', quantity: 3 });

    const res = await deleteItem(
      jsonRequest(`/api/inventory/${item._id}`, { method: 'DELETE' }),
      routeParams({ itemId: item._id.toString() })
    );
    expect(res.status).toBe(200);

    const doc = await InventoryItem.findById(item._id);
    expect(doc).not.toBeNull();
    expect(doc!.isActive).toBe(false);
  });
});

describe('POST /api/inventory/[itemId]/movements', () => {
  async function makeItem(businessId = oid()) {
    signInAs(businessId, 'OWNER');
    return InventoryItem.create({ businessId, name: 'Carne', unit: 'kg', quantity: 10 });
  }

  function post(itemId: string, body: unknown) {
    return createMovement(
      jsonRequest(`/api/inventory/${itemId}/movements`, { method: 'POST', body }),
      routeParams({ itemId })
    );
  }

  it('RESTOCK always adds, even if the client sends a negative delta', async () => {
    const item = await makeItem();
    const res = await post(item._id.toString(), { type: 'RESTOCK', delta: -5 });
    expect(res.status).toBe(200);
    expect((await res.json()).quantity).toBe(15);
  });

  it('WASTE always subtracts, even if the client sends a positive delta', async () => {
    const item = await makeItem();
    await post(item._id.toString(), { type: 'WASTE', delta: 4, note: 'Merma' });
    expect((await InventoryItem.findById(item._id))!.quantity).toBe(6);
    const move = await InventoryMovement.findOne({ inventoryItemId: item._id });
    expect(move).toMatchObject({ type: 'WASTE', delta: -4, resultingQuantity: 6, note: 'Merma' });
  });

  it('ADJUSTMENT keeps the sign as given and records the acting user', async () => {
    const item = await makeItem();
    await post(item._id.toString(), { type: 'ADJUSTMENT', delta: -1.5 });
    expect((await InventoryItem.findById(item._id))!.quantity).toBe(8.5);
    const move = await InventoryMovement.findOne({ inventoryItemId: item._id });
    expect(move!.staffId).toBeDefined();
  });

  it('rejects delta 0, missing delta, and unknown types', async () => {
    const item = await makeItem();
    expect((await post(item._id.toString(), { type: 'RESTOCK', delta: 0 })).status).toBe(400);
    expect((await post(item._id.toString(), { type: 'RESTOCK' })).status).toBe(400);
    expect((await post(item._id.toString(), { type: 'SALE', delta: -1 })).status).toBe(400); // SALE is internal-only
  });

  it('404s for an item of another business', async () => {
    const foreign = await InventoryItem.create({ businessId: oid(), name: 'Ajeno', quantity: 1 });
    signInAs(oid(), 'OWNER');
    expect((await post(foreign._id.toString(), { type: 'RESTOCK', delta: 1 })).status).toBe(404);
  });

  it('GET lists the movement history (manager only)', async () => {
    const businessId = oid();
    const item = await makeItem(businessId);
    await post(item._id.toString(), { type: 'RESTOCK', delta: 5 });
    await post(item._id.toString(), { type: 'WASTE', delta: 2 });

    const res = await listMovements(
      jsonRequest(`/api/inventory/${item._id}/movements`),
      routeParams({ itemId: item._id.toString() })
    );
    const movements = await res.json();
    expect(movements).toHaveLength(2);
    const types = movements.map((m: { type: string }) => m.type).sort();
    expect(types).toEqual(['RESTOCK', 'WASTE']);

    signInAs(businessId, 'STAFF');
    const staffRes = await listMovements(
      jsonRequest(`/api/inventory/${item._id}/movements`),
      routeParams({ itemId: item._id.toString() })
    );
    expect(staffRes.status).toBe(401);
  });
});
