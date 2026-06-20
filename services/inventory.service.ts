import mongoose from 'mongoose';
import InventoryItem from '@/models/InventoryItem';
import InventoryMovement, { InventoryMovementType } from '@/models/InventoryMovement';
import Product from '@/models/Product';
import dbConnect from '@/lib/db';

export const inventoryService = {
  /**
   * Apply a signed delta to an item's stock and record the movement. Used by
   * manual restock/waste/adjustment actions and (internally) by sale deductions.
   * Quantity is never clamped — a negative result is a real signal (oversold
   * or undercounted), not hidden.
   */
  async adjustStock(
    businessId: mongoose.Types.ObjectId,
    itemId: mongoose.Types.ObjectId,
    type: InventoryMovementType,
    delta: number,
    opts: { note?: string; staffId?: mongoose.Types.ObjectId; orderId?: mongoose.Types.ObjectId } = {}
  ) {
    await dbConnect();

    const item = await InventoryItem.findOne({ _id: itemId, businessId });
    if (!item) throw new Error('Artículo de inventario no encontrado');

    item.quantity += delta;
    await item.save();

    await InventoryMovement.create({
      businessId,
      inventoryItemId: itemId,
      type,
      delta,
      resultingQuantity: item.quantity,
      note: opts.note,
      staffId: opts.staffId,
      orderId: opts.orderId,
    });

    return item;
  },

  /**
   * Deduct inventory for a paid order. Only products with a `recipe` touch
   * inventory — items with no recipe are sold without affecting stock.
   * Idempotency (don't double-deduct on a repeated PAID transition) is the
   * caller's responsibility via Order.inventoryDeducted.
   */
  async deductForOrder(
    businessId: mongoose.Types.ObjectId,
    orderId: mongoose.Types.ObjectId,
    items: Array<{ productId: mongoose.Types.ObjectId; name: string; quantity: number }>
  ) {
    await dbConnect();

    const productIds = items.map((i) => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      businessId,
      recipe: { $exists: true, $ne: [] },
    });
    if (products.length === 0) return;

    const productById = new Map(products.map((p) => [String(p._id), p]));

    // Merge consumption across all sold lines per inventory item, so a single
    // ingredient used by two different products on the same ticket gets one
    // combined movement instead of several small ones.
    const consumption = new Map<string, number>();
    for (const line of items) {
      const product = productById.get(String(line.productId));
      if (!product?.recipe) continue;
      for (const recipeLine of product.recipe) {
        const key = String(recipeLine.inventoryItemId);
        const used = recipeLine.quantity * line.quantity;
        consumption.set(key, (consumption.get(key) ?? 0) + used);
      }
    }

    for (const [itemId, used] of consumption) {
      await this.adjustStock(
        businessId,
        new mongoose.Types.ObjectId(itemId),
        'SALE',
        -used,
        { note: 'Venta', orderId }
      );
    }
  },
};
