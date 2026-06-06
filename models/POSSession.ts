import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPOSSession extends Document {
  businessId: mongoose.Types.ObjectId;
  staffId: mongoose.Types.ObjectId;
  staffName: string;

  // Session timing
  startedAt: Date;
  closedAt?: Date;

  // Cash tracking
  openingBalance: number;      // Cash in register at start
  closingBalance?: number;      // Cash in register at end

  // Sales data (calculated from orders)
  totalSales: number;           // Total revenue
  totalOrders: number;

  // Payment breakdown
  cashSales: number;
  cardSales: number;
  transferSales: number;

  // Session status
  status: 'OPEN' | 'CLOSED';    // Current state

  // Cut/Reconciliation
  expectedCash: number;         // opening + cash sales
  actualCash: number;           // closingBalance
  variance: number;             // difference (discrepancy)

  // Notes
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const POSSessionSchema = new Schema<IPOSSession>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    staffName: { type: String, required: true },

    startedAt: { type: Date, required: true, index: true },
    closedAt: { type: Date },

    openingBalance: { type: Number, required: true, default: 0 },
    closingBalance: { type: Number },

    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },

    cashSales: { type: Number, default: 0 },
    cardSales: { type: Number, default: 0 },
    transferSales: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },

    expectedCash: { type: Number, default: 0 },
    actualCash: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },

    notes: { type: String },
  },
  { timestamps: true }
);

POSSessionSchema.index({ businessId: 1, status: 1 });
POSSessionSchema.index({ businessId: 1, startedAt: -1 });

const POSSession: Model<IPOSSession> =
  mongoose.models.POSSession || mongoose.model<IPOSSession>('POSSession', POSSessionSchema);

export default POSSession;
