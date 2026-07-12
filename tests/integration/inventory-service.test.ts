import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { oid } from '../helpers/fixtures';
import { inventoryService } from '@/services/inventory.service';
import InventoryItem from '@/models/InventoryItem';
import InventoryMovement from '@/models/InventoryMovement';
import Product from '@/models/Product';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('inventoryService.adjustStock', () => {
  it('applies the delta and records a movement with the resulting quantity', async () => {
    const businessId = oid();
    const item = await InventoryItem.create({ businessId, name: 'Café', unit: 'kg', quantity: 10 });

    const updated = await inventoryService.adjustStock(businessId, item._id, 'RESTOCK', 5, {
      note: 'Compra',
    });

    expect(updated.quantity).toBe(15);
    const movements = await InventoryMovement.find({ inventoryItemId: item._id });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'RESTOCK', delta: 5, resultingQuantity: 15, note: 'Compra' });
  });

  it('allows stock to go negative (oversell is a signal, not clamped)', async () => {
    const businessId = oid();
    const item = await InventoryItem.create({ businessId, name: 'Limón', unit: 'kg', quantity: 1 });

    const updated = await inventoryService.adjustStock(businessId, item._id, 'SALE', -3);
    expect(updated.quantity).toBe(-2);
  });

  it('throws for an item outside the business (tenant isolation)', async () => {
    const item = await InventoryItem.create({ businessId: oid(), name: 'Ajo', quantity: 5 });
    await expect(
      inventoryService.adjustStock(oid(), item._id, 'RESTOCK', 1)
    ).rejects.toThrow('Artículo de inventario no encontrado');
  });
});

describe('inventoryService.deductForOrder', () => {
  it('merges consumption per ingredient across products into one SALE movement each', async () => {
    const businessId = oid();
    const orderId = oid();
    const carne = await InventoryItem.create({ businessId, name: 'Carne', unit: 'kg', quantity: 10 });
    const queso = await InventoryItem.create({ businessId, name: 'Queso', unit: 'kg', quantity: 5 });

    const taco = await Product.create({
      businessId, name: 'Taco', price: 30, category: 'Tacos',
      recipe: [{ inventoryItemId: carne._id, quantity: 0.5 }],
    });
    const gringa = await Product.create({
      businessId, name: 'Gringa', price: 60, category: 'Tacos',
      recipe: [
        { inventoryItemId: carne._id, quantity: 1 },
        { inventoryItemId: queso._id, quantity: 2 },
      ],
    });

    await inventoryService.deductForOrder(businessId, orderId, [
      { productId: taco._id, name: 'Taco', quantity: 2 },   // carne: 1.0
      { productId: gringa._id, name: 'Gringa', quantity: 1 }, // carne: 1.0, queso: 2.0
    ]);

    expect((await InventoryItem.findById(carne._id))!.quantity).toBe(8);  // 10 - 2
    expect((await InventoryItem.findById(queso._id))!.quantity).toBe(3); // 5 - 2

    const carneMoves = await InventoryMovement.find({ inventoryItemId: carne._id });
    expect(carneMoves).toHaveLength(1); // merged, not one per product line
    expect(carneMoves[0]).toMatchObject({ type: 'SALE', delta: -2, orderId });
  });

  it('does nothing for products without a recipe', async () => {
    const businessId = oid();
    const refresco = await Product.create({ businessId, name: 'Refresco', price: 25, category: 'Bebidas' });

    await inventoryService.deductForOrder(businessId, oid(), [
      { productId: refresco._id, name: 'Refresco', quantity: 4 },
    ]);

    expect(await InventoryMovement.countDocuments({ businessId })).toBe(0);
  });
});
