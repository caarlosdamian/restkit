import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInventoryItem extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  unit: string;
  /** Current stock. Allowed to go negative — a negative count is a real
   *  signal (oversold/undercounted), not clamped away. */
  quantity: number;
  /** Alert threshold: 0 < quantity <= lowStockThreshold shows as "Stock bajo". */
  lowStockThreshold: number;
  category: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true },
    unit: { type: String, required: true, default: 'unidad' },
    quantity: { type: Number, required: true, default: 0 },
    lowStockThreshold: { type: Number, required: true, default: 0, min: 0 },
    category: { type: String, required: true, default: 'General' },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ businessId: 1, isActive: 1 });

const InventoryItem: Model<IInventoryItem> =
  mongoose.models.InventoryItem || mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);

export default InventoryItem;
