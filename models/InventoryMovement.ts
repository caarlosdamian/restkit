import mongoose, { Schema, Document, Model } from 'mongoose';

export type InventoryMovementType = 'RESTOCK' | 'WASTE' | 'ADJUSTMENT' | 'SALE';

export interface IInventoryMovement extends Document {
  businessId: mongoose.Types.ObjectId;
  inventoryItemId: mongoose.Types.ObjectId;
  type: InventoryMovementType;
  /** Signed change applied to quantity (positive or negative). */
  delta: number;
  /** Snapshot of quantity right after this movement, for readable history. */
  resultingQuantity: number;
  note?: string;
  /** Set when type === 'SALE' — the order that triggered the deduction. */
  orderId?: mongoose.Types.ObjectId;
  /** Who made a manual movement (restock/waste/adjustment). */
  staffId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    inventoryItemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    type: { type: String, enum: ['RESTOCK', 'WASTE', 'ADJUSTMENT', 'SALE'], required: true },
    delta: { type: Number, required: true },
    resultingQuantity: { type: Number, required: true },
    note: { type: String },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    staffId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const InventoryMovement: Model<IInventoryMovement> =
  mongoose.models.InventoryMovement ||
  mongoose.model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema);

export default InventoryMovement;
