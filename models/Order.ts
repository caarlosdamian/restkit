import mongoose, { Schema, Document, Model } from 'mongoose';

export type OrderStatus = 'OPEN' | 'IN_KITCHEN' | 'READY' | 'PAID' | 'CANCELLED';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  /** Waiter who first added this line (Fase 2 attribution). */
  addedBy?: mongoose.Types.ObjectId;
  /** Units the kitchen has marked prepared on the KDS (0..quantity). */
  preparedQty?: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export interface IOrder extends Document {
  tableId: mongoose.Types.ObjectId;
  tableName: string;
  businessId: mongoose.Types.ObjectId;
  staffId: mongoose.Types.ObjectId;
  status: OrderStatus;
  items: IOrderItem[];
  total: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
  amountReceived?: number;
  change?: number;
  ticketNumber?: string;
  closedAt?: Date;
  /** When the ticket first entered the kitchen — drives KDS FIFO + aging timer. */
  kitchenAt?: Date;
  /** True once inventory has been deducted for this order (PAID transition).
   *  Guards against double-deduction if PAID is re-applied (e.g. retried PATCH). */
  inventoryDeducted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    notes: { type: String },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    preparedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', required: true, index: true },
    tableName: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['OPEN', 'IN_KITCHEN', 'READY', 'PAID', 'CANCELLED'],
      default: 'OPEN',
    },
    items: [OrderItemSchema],
    total: { type: Number, default: 0 },
    notes: { type: String },
    paymentMethod: { type: String, enum: ['CASH', 'CARD', 'TRANSFER', 'OTHER'] },
    amountReceived: { type: Number },
    change: { type: Number },
    ticketNumber: { type: String },
    closedAt: { type: Date },
    kitchenAt: { type: Date },
    inventoryDeducted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// At most ONE active order per table, enforced by the database. Concurrent
// creators (two terminals opening the same table, StrictMode double-mounts)
// race the application-level existence check; the loser gets an E11000 that
// POST /api/orders turns into "return the existing active order".
OrderSchema.index(
  { tableId: 1 },
  {
    name: 'uniq_active_order_per_table',
    unique: true,
    partialFilterExpression: { status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] } },
  }
);

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
