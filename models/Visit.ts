import mongoose, { Schema, Document, Model } from 'mongoose';

/** ACCRUAL — earned from a paid order (or recorded by hand).
 *  REWARD_REDEMPTION — a reward or cashback balance was spent.
 *  REVERSAL — compensates an earlier entry. Nothing is ever deleted, so the
 *  history always explains how the current counter was reached. */
export type VisitType = 'ACCRUAL' | 'REVERSAL' | 'REWARD_REDEMPTION';

export interface IVisit extends Document {
  customerId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  type: VisitType;
  /** Which mechanic this entry moved. */
  mechanic: 'sellos' | 'cashback';
  /** Signed change applied to the customer's counter: stamps for 'sellos'
   *  (+1 / -1), MXN for 'cashback' (+17.5 / -128). */
  delta: number;
  /** The order that produced this entry. Absent for entries recorded by hand
   *  from the dashboard. */
  orderId?: mongoose.Types.ObjectId;
  /** Denormalised for the history list so rendering it needs no join. */
  orderTotal?: number;
  tableName?: string;
  /** For REVERSAL — the entry being compensated. */
  reversesVisitId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VisitSchema: Schema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['ACCRUAL', 'REVERSAL', 'REWARD_REDEMPTION'],
      default: 'ACCRUAL',
      index: true,
    },
    mechanic: {
      type: String,
      enum: ['sellos', 'cashback'],
      default: 'sellos',
    },
    delta: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    orderTotal: { type: Number },
    tableName: { type: String },
    reversesVisitId: { type: Schema.Types.ObjectId, ref: 'Visit' },
  },
  { timestamps: true }
);

// The customer history page reads this constantly, newest first, 10 at a time.
VisitSchema.index({ customerId: 1, createdAt: -1 });

// One accrual per order, per mechanic. Makes a retried PATCH that re-applies
// PAID a no-op at the database level rather than a second stamp.
VisitSchema.index(
  { orderId: 1, mechanic: 1 },
  {
    name: 'uniq_accrual_per_order',
    unique: true,
    partialFilterExpression: { type: 'ACCRUAL', orderId: { $exists: true } },
  }
);

const Visit: Model<IVisit> = mongoose.models.Visit || mongoose.model<IVisit>('Visit', VisitSchema);

export default Visit;
